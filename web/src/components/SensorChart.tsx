import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { SENSOR_KEYS, SENSOR_META } from '../data/sensorMeta'
import type { HistoryEntry } from '../types/fleet'

interface SensorChartProps {
  history: HistoryEntry[]
  selectedSensor: string
  /** Show this aircraft's PC1 trend (see fit_pca_pc1 in
   * prepare_fleet_data.py) instead of a single raw sensor. */
  showPC1: boolean
  onSelectSensor: (key: string) => void
  onTogglePC1: () => void
}

type ChartRow = { cycle: number } & Record<string, number>

/**
 * Line chart over an aircraft's cycle history: either one sensor at its
 * real scale and unit (labels from sensorMeta.ts) or its PC1 trend.
 *
 * Args:
 *   history: Per-cycle records.
 *   selectedSensor: The active sensor key, e.g. "Nf".
 *   showPC1: Whether to show PC1 instead of the selected sensor.
 *   onSelectSensor: Called with a sensor key when picked.
 *   onTogglePC1: Called to toggle showPC1.
 *
 * Returns:
 *   The chart plus its sensor picker.
 */
export function SensorChart({
  history,
  selectedSensor,
  showPC1,
  onSelectSensor,
  onTogglePC1,
}: SensorChartProps): JSX.Element {
  const chartData: ChartRow[] = useMemo(() => {
    if (showPC1) {
      return history.map((h) => ({ cycle: h.cycle, pc1: h.pc1 }))
    }
    return history.map((h) => ({ cycle: h.cycle, value: h.sensors[selectedSensor] }))
  }, [history, selectedSensor, showPC1])

  const activeMeta = SENSOR_META[selectedSensor]

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="thin-scroll flex gap-2 overflow-x-auto pb-2">
          {SENSOR_KEYS.map((key) => (
            <button
              key={key}
              title={SENSOR_META[key].label}
              onClick={() => onSelectSensor(key)}
              className={`shrink-0 rounded-xl px-2.5 py-1.5 text-xs font-medium transition ${!showPC1 && selectedSensor === key
                ? 'bg-accent text-white'
                : 'bg-surface-soft text-ink-dim hover:text-ink'
                }`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-ink-dim">
          {showPC1 ? 'Sensor PC1' : `${activeMeta.label}${activeMeta.unit ? ` (${activeMeta.unit})` : ''}`}
        </span>
        <label className="flex items-center gap-1.5 text-xs text-ink-dim">
          <input type="checkbox" checked={showPC1} onChange={onTogglePC1} className="accent-accent" />
          Show PC1
        </label>
      </div>

      <div className="mt-2 h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 20, left: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E7ECE6" />
            <XAxis
              dataKey="cycle"
              tick={{ fontSize: 10, fill: '#6E7580' }}
              label={{ value: 'Time Cycle', position: 'insideBottom', offset: -12, fontSize: 11, fill: '#6E7580' }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#6E7580' }}
              width={34}
              label={{
                value: showPC1 ? 'Sensor PC1' : activeMeta.unit || activeMeta.label,
                angle: -90,
                position: 'insideLeft',
                style: { textAnchor: 'middle' },
                fontSize: 11,
                fill: '#6E7580',
              }}
            />
            <Tooltip />
            {showPC1 ? (
              <Line
                type="monotone"
                dataKey="pc1"
                name="PC1"
                stroke="#0A84FF"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ) : (
              <Line
                type="monotone"
                dataKey="value"
                name={activeMeta.label}
                stroke="#0A84FF"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
