import { useMemo, useState } from 'react'
import { getHealthStatus } from '../utils/status'
import { OP_SETTING_META, SENSOR_META, formatOpSetting } from '../data/sensorMeta'
import { SensorChart } from './SensorChart'
import type { Aircraft, HistoryEntry, OpSettings } from '../types/fleet'

interface AircraftDetailProps {
  aircraft: Aircraft
  /** From usePredictions -- undefined while the API call is in flight. */
  predictedRUL: number | undefined
  /** Current history entry (see utils/liveCycle.ts). Undefined until the
   * first live update, when the panel falls back to the first cycle. */
  liveEntry: HistoryEntry | undefined
}

const OP_SETTING_KEYS: Array<keyof OpSettings> = ['altitudeFt', 'mach', 'tra']
const DEFAULT_SENSOR = Object.keys(SENSOR_META)[0]

/**
 * Full breakdown for one aircraft: predicted RUL, current operating
 * settings, and a sensor chart covering cycles up to the current one.
 *
 * Args:
 *   aircraft: One fleet entry.
 *   predictedRUL: The model's predicted RUL, if it's arrived yet.
 *   liveEntry: This aircraft's current live history entry.
 *
 * Returns:
 *   The detail panel content.
 */
export function AircraftDetail({ aircraft, predictedRUL, liveEntry }: AircraftDetailProps): JSX.Element {
  const [selectedSensor, setSelectedSensor] = useState<string>(DEFAULT_SENSOR)
  const [showPC1, setShowPC1] = useState<boolean>(false)
  const status = getHealthStatus(predictedRUL)
  const entry = liveEntry ?? aircraft.history[0]

  // Only cycles reached so far, matching the popup and fleet chart.
  const historyUpToNow = useMemo(
    () => aircraft.history.filter((h) => h.cycle <= entry.cycle),
    [aircraft.history, entry.cycle],
  )

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">{aircraft.nickname}</h2>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
          style={{ backgroundColor: status.color }}
        >
          {status.label}
        </span>
      </div>
      <div className="mt-1 text-xs text-ink-dim">Cycle {entry.cycle}</div>

      <div className="mt-3 rounded-xl2 bg-surface-soft p-3">
        <div className="text-xs text-ink-dim">Predicted RUL</div>
        <div className="text-2xl font-semibold text-ink">
          {predictedRUL === undefined ? '—' : `${predictedRUL} cycles`}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {OP_SETTING_KEYS.map((key) => (
          <div key={key} className="rounded-lg bg-surface-soft p-2 text-center">
            <div className="text-[12px] text-ink-dim">{OP_SETTING_META[key].label}</div>
            <div className="text-sm font-medium text-ink">{formatOpSetting(key, entry.opSettings[key])}</div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-semibold text-ink">Sensor readouts</h3>
        <SensorChart
          history={historyUpToNow}
          selectedSensor={selectedSensor}
          showPC1={showPC1}
          onSelectSensor={(key) => {
            setShowPC1(false)
            setSelectedSensor(key)
          }}
          onTogglePC1={() => setShowPC1((v) => !v)}
        />
      </div>
    </div>
  )
}
