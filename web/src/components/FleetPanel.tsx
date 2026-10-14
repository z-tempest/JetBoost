import { useMemo, useState } from 'react'
import { LineChart, Line, ReferenceDot, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
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

interface ConditionSeries {
  rows: DegradationRow[]
  /** id -> the aircraft's failure point (RUL 0) as chart coordinates: x is the
   * 1-based cycle count within this condition, y its PC1. Only present once
   * the aircraft has reached RUL 0 and that last cycle was flown under this
   * condition; used to draw the X. */
  fails: Record<string, { cycle: number; pc1: number }>
}

/**
 * Builds chart rows for one operating condition. The x value is the Nth cycle
 * an aircraft has spent under this condition (not its raw cycle number), so
 * each aircraft's points sit side by side and the line is continuous. Plotting
 * raw cycle numbers instead leaves a gap at every cycle spent under another
 * condition, and since FD004 switches condition almost every cycle, most
 * points end up isolated with no line between them.
 *
 * Args:
 *   fleet: The fleet.
 *   liveEntries: Each aircraft's current live history entry.
 *   conditionKey: Which condition (from detectConditions) to filter to.
 *
 * Returns:
 *   Rows of { cycle (Nth cycle in this condition), [aircraftId]: pc1 | null },
 *   plus each aircraft's failure point (RUL 0), if it falls under this
 *   condition.
 */
function buildConditionRows(
  fleet: Aircraft[],
  liveEntries: Record<string, HistoryEntry>,
  conditionKey: string,
): ConditionSeries {
  const columns: Record<string, number[]> = {}
  const fails: Record<string, { cycle: number; pc1: number }> = {}
  let maxN = 0

  fleet.forEach((a) => {
    const liveCycle = liveEntries[a.id]?.cycle
    const values: number[] = []
    if (liveCycle !== undefined) {
      for (const entry of a.history) {
        if (entry.cycle > liveCycle) break
        if (conditionKeyFor(entry.opSettings) !== conditionKey) continue
        values.push(entry.pc1)
        if (entry.cyclesRemaining === 0) fails[a.id] = { cycle: values.length, pc1: entry.pc1 }
      }
    }
    columns[a.id] = values
    maxN = Math.max(maxN, values.length)
  })

  const rows: DegradationRow[] = []
  for (let n = 0; n < maxN; n++) {
    const row = { cycle: n + 1 } as DegradationRow
    fleet.forEach((a) => {
      row[a.id] = columns[a.id][n] ?? null
    })
    rows.push(row)
  }
  return { rows, fails }
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
 *   series: Its chart data, from buildConditionRows.
 *   fleet: The fleet, for per-line color/name.
 *   predictions: id -> predicted RUL, for line color.
 *   yDomain: Shared y-axis range across all conditions.
 *
 * Returns:
 *   The labeled chart.
 */
function ConditionChart({
  condition,
  series,
  fleet,
  predictions,
  yDomain,
}: {
  condition: OperatingCondition
  series: ConditionSeries
  fleet: Aircraft[]
  predictions: PredictionMap
  yDomain: [number, number]
}): JSX.Element {
  const { rows, fails } = series
  return (
    <div>
      <div className="text-xs font-medium text-ink">{condition.label}</div>
      <div className="mt-1 h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 4, right: 8, bottom: 20, left: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E7ECE6" />
            <XAxis
              dataKey="cycle"
              type="number"
              domain={[1, 'dataMax']}
              allowDecimals={false}
              tick={{ fontSize: 9, fill: '#6E7580' }}
              label={{ value: 'Operating Cycle', position: 'insideBottom', offset: -10, fontSize: 10, fill: '#6E7580' }}
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
                type="linear"
                dataKey={a.id}
                name={a.nickname}
                stroke={getHealthStatus(predictions[a.id]).color}
                strokeWidth={1.1}
                strokeOpacity={0.75}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
                // Nulls only appear after an aircraft's last point, so there
                // is nothing in the middle of a line to bridge.
                connectNulls={false}
              />
            ))}
            {/* X at each failure point (RUL 0). One element per failed aircraft
                instead of a dot callback on every point, which rendered
                thousands of extra SVG nodes on every live tick. */}
            {Object.entries(fails).map(([id, f]) => (
              <ReferenceDot
                key={id}
                x={f.cycle}
                y={f.pc1}
                ifOverflow="visible"
                shape={({ cx, cy }: { cx?: number; cy?: number }) =>
                  cx == null || cy == null ? (
                    <g />
                  ) : (
                    <g stroke="#8B0A2E" strokeWidth={1.5} strokeLinecap="round">
                      <line x1={cx - 2.5} y1={cy - 2.5} x2={cx + 2.5} y2={cy + 2.5} />
                      <line x1={cx - 2.5} y1={cy + 2.5} x2={cx + 2.5} y2={cy - 2.5} />
                    </g>
                  )
                }
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
    () => conditions.map((condition) => ({ condition, series: buildConditionRows(fleet, liveEntries, condition.key) })),
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
        PC1 of every sensor, z-scored within each operating condition and fit once across the full
        raw population -- not the commanded op settings. One chart per condition (rounded
        altitude/Mach/TRA); the x-axis counts cycles spent under that condition. Each line stops at
        that aircraft's current cycle; an X marks where it reaches RUL 0.
      </p>

      <div className="mt-2 space-y-4">
        {conditionRows.map(({ condition, series }) => (
          <ConditionChart
            key={condition.key}
            condition={condition}
            series={series}
            fleet={fleet}
            predictions={predictions}
            yDomain={yDomain}
          />
        ))}
      </div>
    </div>
  )
}
