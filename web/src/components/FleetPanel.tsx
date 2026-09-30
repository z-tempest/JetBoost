import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { getHealthStatus } from '../utils/status'
import { detectConditions, conditionKeyFor, type OperatingCondition } from '../utils/operatingCondition'
import type { Aircraft, HistoryEntry, PredictionMap } from '../types/fleet'

interface FleetPanelProps {
  fleet: Aircraft[]
  /** Aircraft without a prediction yet are left out of the at-risk list. */
  predictions: PredictionMap
  /** id -> each aircraft's current history entry. Each chart line stops at
   * its aircraft's current cycle. */
  liveEntries: Record<string, HistoryEntry>
  onSelectAircraft: (id: string) => void
}

type DegradationRow = { cycle: number } & Record<string, number | null>

/**
 * Builds chart rows for one operating condition: one row per cycle, with
 * each aircraft's PC1 in its column if that cycle falls under this
 * condition and is at or before the aircraft's current cycle, otherwise
 * null. Recharts draws nulls as gaps, so a line only has points for
 * cycles actually flown under this condition.
 *
 * Args:
 *   fleet: The fleet.
 *   liveEntries: Each aircraft's current live history entry.
 *   conditionKey: Which condition (from detectConditions) to filter to.
 *
 * Returns:
 *   Rows of { cycle, [aircraftId]: pc1 | null, ... }.
 */
function buildConditionRows(
  fleet: Aircraft[],
  liveEntries: Record<string, HistoryEntry>,
  conditionKey: string,
): DegradationRow[] {
  const maxCycle = Math.max(...fleet.map((a) => a.history.length))
  const rows: DegradationRow[] = []
  for (let c = 0; c < maxCycle; c++) {
    const row = { cycle: c } as DegradationRow
    fleet.forEach((a) => {
      const entry = a.history[c]
      const liveCycle = liveEntries[a.id]?.cycle
      const inCondition = entry !== undefined && conditionKeyFor(entry.opSettings) === conditionKey
      row[a.id] = inCondition && liveCycle !== undefined && entry.cycle <= liveCycle ? entry.pc1 : null
    })
    rows.push(row)
  }
  return rows
}

/**
 * A shared PC1 y-axis range (with padding) across every condition subplot,
 * so line heights are comparable between subplots.
 *
 * Args:
 *   fleet: The fleet.
 *
 * Returns:
 *   [min, max].
 */
function sharedPc1Domain(fleet: Aircraft[]): [number, number] {
  let min = Infinity
  let max = -Infinity
  fleet.forEach((a) =>
    a.history.forEach((h) => {
      if (h.pc1 < min) min = h.pc1
      if (h.pc1 > max) max = h.pc1
    }),
  )
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1]
  const pad = (max - min) * 0.08 || 1
  return [Math.floor((min - pad) * 100) / 100, Math.ceil((max + pad) * 100) / 100]
}

/**
 * One condition's subplot: each aircraft's PC1 while under this condition,
 * up to its current cycle.
 *
 * Args:
 *   condition: The condition this subplot covers.
 *   rows: Its chart data, from buildConditionRows.
 *   fleet: The fleet, for per-line color/name.
 *   predictions: id -> predicted RUL, for line color.
 *   yDomain: Shared y-axis range across all conditions.
 *
 * Returns:
 *   The labeled chart.
 */
function ConditionChart({
  condition,
  rows,
  fleet,
  predictions,
  yDomain,
}: {
  condition: OperatingCondition
  rows: DegradationRow[]
  fleet: Aircraft[]
  predictions: PredictionMap
  yDomain: [number, number]
}): JSX.Element {
  return (
    <div>
      <div className="text-xs font-medium text-ink">{condition.label}</div>
      <div className="mt-1 h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 4, right: 8, bottom: 20, left: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E7ECE6" />
            <XAxis
              dataKey="cycle"
              tick={{ fontSize: 9, fill: '#6E7580' }}
              label={{ value: 'Time Cycle', position: 'insideBottom', offset: -10, fontSize: 10, fill: '#6E7580' }}
            />
            <YAxis
              domain={yDomain}
              tick={{ fontSize: 9, fill: '#6E7580' }}
              width={32}
              label={{
                value: 'Sensor PC1',
                angle: -90,
                position: 'insideLeft',
                style: { textAnchor: 'middle' },
                fontSize: 10,
                fill: '#6E7580',
              }}
            />
            <Tooltip />
            {fleet.map((a) => (
              <Line
                key={a.id}
                type="monotone"
                dataKey={a.id}
                name={a.nickname}
                stroke={getHealthStatus(predictions[a.id]).color}
                strokeWidth={1.1}
                strokeOpacity={0.75}
                dot={false}
                isAnimationActive={false}
                // A gap means the aircraft was under a different condition at
                // that cycle; never bridge it.
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/**
 * Fleet-wide sidebar view: a threshold-adjustable at-risk list based on
 * predicted RUL, and one live PC1-vs-cycle chart per operating condition.
 *
 * Aircraft jump between discrete altitude/Mach/TRA regimes, which moves PC1
 * far more than gradual degradation does, so a single overlaid chart buries
 * the trend. Splitting by rounded condition (see utils/operatingCondition.ts)
 * isolates it. The number of charts follows the data: one for FD001/FD003,
 * six for FD002/FD004.
 *
 * Args:
 *   fleet: The fleet.
 *   predictions: id -> predicted RUL, from usePredictions.
 *   liveEntries: Each aircraft's current live history entry.
 *   onSelectAircraft: Called with an aircraft id when a list row is
 *     clicked.
 *
 * Returns:
 *   The fleet panel content.
 */
export function FleetPanel({ fleet, predictions, liveEntries, onSelectAircraft }: FleetPanelProps): JSX.Element {
  const [threshold, setThreshold] = useState<number>(30)

  const conditions = useMemo(() => detectConditions(fleet), [fleet])
  const yDomain = useMemo(() => sharedPc1Domain(fleet), [fleet])
  const conditionRows = useMemo(
    () => conditions.map((condition) => ({ condition, rows: buildConditionRows(fleet, liveEntries, condition.key) })),
    [conditions, fleet, liveEntries],
  )

  const atRisk = fleet
    .filter((a) => predictions[a.id] !== undefined && (predictions[a.id] as number) < threshold)
    .sort((a, b) => (predictions[a.id] as number) - (predictions[b.id] as number))

  return (
    <div>
      <h2 className="text-lg font-semibold text-ink">Fleet overview</h2>

      <div className="mt-3 flex items-center gap-2">
        <label className="text-xs text-ink-dim">At-risk threshold (RUL &lt;)</label>
        <input
          type="number"
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className="w-16 rounded-lg border border-black/10 bg-surface-soft px-2 py-1 text-sm text-ink"
        />
      </div>

      <div className="thin-scroll mt-2 max-h-80 space-y-1 overflow-y-auto">
        {atRisk.length === 0 && (
          <div className="rounded-lg bg-surface-soft p-3 text-center text-xs text-ink-dim">
            No aircraft under {threshold} cycles.
          </div>
        )}
        {atRisk.map((a) => {
          const status = getHealthStatus(predictions[a.id])
          return (
            <button
              key={a.id}
              onClick={() => onSelectAircraft(a.id)}
              className="flex w-full items-center justify-between rounded-lg bg-surface-soft px-3 py-2 text-left transition hover:bg-black/5"
            >
              <span className="text-sm text-ink">{a.nickname}</span>
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                style={{ backgroundColor: status.color }}
              >
                {predictions[a.id]} cyc
              </span>
            </button>
          )
        })}
      </div>

      <h3 className="mt-4 text-sm font-semibold text-ink">Fleet-wide sensor PCA (live)</h3>
      <p className="mt-0.5 text-[11px] text-ink-dim">
        PC1 of every sensor, z-scored and fit once across the full raw population -- not the
        commanded op settings. Split below by operating condition (rounded altitude/Mach/TRA) so
        condition-to-condition swings don't bury the degradation trend. Each line stops at that
        aircraft's current cycle.
      </p>

      <div className="mt-2 space-y-4">
        {conditionRows.map(({ condition, rows }) => (
          <ConditionChart
            key={condition.key}
            condition={condition}
            rows={rows}
            fleet={fleet}
            predictions={predictions}
            yDomain={yDomain}
          />
        ))}
      </div>
    </div>
  )
}
