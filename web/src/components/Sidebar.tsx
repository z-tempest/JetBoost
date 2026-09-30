import { motion, AnimatePresence } from 'framer-motion'
import { AircraftDetail } from './AircraftDetail'
import { FleetPanel } from './FleetPanel'
import type { Aircraft, HistoryEntry, PredictionMap, SidebarMode } from '../types/fleet'

interface SidebarProps {
  mode: SidebarMode
  aircraft: Aircraft | null
  fleet: Aircraft[]
  predictions: PredictionMap
  /** id -> each aircraft's current history entry, kept fresh by App. */
  liveEntries: Record<string, HistoryEntry>
  onModeChange: (mode: 'aircraft' | 'fleet') => void
  onClose: () => void
  onSelectAircraft: (id: string) => void
}

/**
 * Right-hand overlay sidebar. Tabs between a single aircraft's full
 * breakdown and the fleet-wide view; slides in/out with the main map
 * visible underneath.
 *
 * Args:
 *   mode: 'aircraft' | 'fleet' | null (closed).
 *   aircraft: The selected aircraft, if mode is 'aircraft'.
 *   fleet: The full fleet, for the fleet-wide view.
 *   liveEntries: Each aircraft's current live history entry.
 *   onModeChange: Called with a new mode when a tab is clicked.
 *   onClose: Called to close the sidebar entirely.
 *   onSelectAircraft: Called with an id from the fleet list.
 *
 * Returns:
 *   The sidebar, animated in/out via AnimatePresence.
 */
export function Sidebar({
  mode,
  aircraft,
  fleet,
  predictions,
  liveEntries,
  onModeChange,
  onClose,
  onSelectAircraft,
}: SidebarProps): JSX.Element {
  return (
    <AnimatePresence>
      {mode && (
        <motion.div
          className="absolute right-4 top-4 bottom-4 z-40 min-w-96 w-1/4 overflow-hidden rounded-xl2 bg-white/90 shadow-panel backdrop-blur"
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
            <div className="flex gap-1 rounded-full bg-surface-soft p-0.5">
              <button
                onClick={() => onModeChange('aircraft')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${mode === 'aircraft' ? 'bg-white text-ink shadow-sm' : 'text-ink-dim'
                  }`}
              >
                Aircraft
              </button>
              <button
                onClick={() => onModeChange('fleet')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${mode === 'fleet' ? 'bg-white text-ink shadow-sm' : 'text-ink-dim'
                  }`}
              >
                Fleet
              </button>
            </div>
            <button onClick={onClose} className="text-ink-dim transition hover:text-ink">
              ✕
            </button>
          </div>

          {/* Keyed so switching aircraft or tabs resets the scroll position. */}
          <div
            key={mode === 'aircraft' ? aircraft?.id : mode}
            className="thin-scroll h-[calc(100%-49px)] overflow-y-auto p-4"
          >
            {mode === 'aircraft' &&
              (aircraft ? (
                <AircraftDetail
                  aircraft={aircraft}
                  predictedRUL={predictions[aircraft.id]}
                  liveEntry={liveEntries[aircraft.id]}
                />
              ) : (
                <div className="mt-8 text-center text-sm text-ink-dim">
                  Select an aircraft on the map to see its breakdown.
                </div>
              ))}
            {mode === 'fleet' && (
              <FleetPanel
                fleet={fleet}
                predictions={predictions}
                liveEntries={liveEntries}
                onSelectAircraft={onSelectAircraft}
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
