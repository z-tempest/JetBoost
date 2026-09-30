import { OP_SETTING_META, formatOpSetting } from '../data/sensorMeta'
import type { Aircraft, HealthStatus, HistoryEntry, OpSettings } from '../types/fleet'

interface AircraftPopupProps {
  aircraft: Aircraft
  status: HealthStatus
  /** Undefined while the API call is in flight (status is "pending"). */
  predictedRUL: number | undefined
  /** Current history entry (see utils/liveCycle.ts). */
  entry: HistoryEntry
  onFullBreakdown: () => void
}

const OP_SETTING_KEYS: Array<keyof OpSettings> = ['altitudeFt', 'mach', 'tra']

/**
 * Small info card shown next to a clicked plane: its real operating
 * settings (altitude, Mach, TRA), its PC1 sensor summary, and its
 * predicted RUL, plus a button to open the full sidebar breakdown.
 *
 * Args:
 *   aircraft: One fleet entry.
 *   status: Health status from getHealthStatus.
 *   predictedRUL: The model's predicted RUL, if it's arrived yet.
 *   entry: This aircraft's current live history entry.
 *   onFullBreakdown: Called when "Full breakdown" is clicked.
 *
 * Returns:
 *   The popup card.
 */
export function AircraftPopup({
  aircraft,
  status,
  predictedRUL,
  entry,
  onFullBreakdown,
}: AircraftPopupProps): JSX.Element {
  return (
    <div
      className="w-60 rounded-xl2 border border-black/5 bg-white/95 p-3 shadow-panel backdrop-blur"
      // Keep clicks inside the popup from reaching the canvas, where they
      // would fire onPointerMissed (MapView) and deselect the aircraft.
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">{aircraft.nickname}</span>
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
          style={{ backgroundColor: status.color }}
        >
          {status.label}
        </span>
      </div>

      <div className="mt-1 text-[10px] text-ink-dim">Cycle {entry.cycle}</div>

      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
        {OP_SETTING_KEYS.map((key) => (
          <div key={key} className="rounded-lg bg-surface-soft px-1.5 py-1">
            <div className="text-[10px] text-ink-dim">{OP_SETTING_META[key].label}</div>
            <div className="text-xs font-medium text-ink">
              {formatOpSetting(key, entry.opSettings[key])}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-ink-dim">PC1</span>
        <span className="font-medium text-ink">{entry.pc1}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs">
        <span className="text-ink-dim">Predicted RUL</span>
        <span className="font-semibold text-ink">
          {predictedRUL === undefined ? 'Predicting…' : `${predictedRUL} cycles`}
        </span>
      </div>

      <button
        onClick={onFullBreakdown}
        className="mt-3 w-full rounded-lg bg-accent px-2 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
      >
        Full breakdown
      </button>
    </div>
  )
}
