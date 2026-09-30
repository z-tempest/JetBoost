import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import type { Aircraft, HistoryEntry, SidebarMode } from './types/fleet.ts'
import { loadDemoFleet } from './data/loadFleet'
import { usePredictions } from './hooks/usePredictions'
import { MapView } from './components/MapView'
import { TopBar } from './components/TopBar'
import { Sidebar } from './components/Sidebar'
import { Onboarding } from './components/Onboarding'

/**
 * Root app component. The 3D map fills the viewport, with the onboarding
 * overlay, top bar, and sidebar layered on top. Fleet data comes from
 * public/data/fleet.json; predicted RUL comes from the inference API via
 * usePredictions.
 *
 * Args:
 *   None.
 *
 * Returns:
 *   JSX.Element: The whole app.
 */
export default function App(): JSX.Element {
  const [fleet, setFleet] = useState<Aircraft[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(true)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(null)
  /** id -> each aircraft's current history entry, updated by MapView's
   * onLiveUpdate. Lets components outside the canvas show the same "now"
   * as the popup. */
  const [liveEntries, setLiveEntries] = useState<Record<string, HistoryEntry>>({})

  // Predicted RUL per aircraft at its current cycle, from the inference API.
  const { predictions } = usePredictions(fleet, liveEntries)

  const handleLiveUpdate = useCallback((id: string, entry: HistoryEntry) => {
    setLiveEntries((prev) => (prev[id] === entry ? prev : { ...prev, [id]: entry }))
  }, [])

  useEffect(() => {
    loadDemoFleet()
      .then((loaded) => {
        setFleet(loaded)
        // Seed each aircraft's first cycle so nothing renders empty before
        // the first live tick.
        setLiveEntries(Object.fromEntries(loaded.map((a) => [a.id, a.history[0]])))
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : String(err)))
  }, [])

  if (loadError) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-soft text-sm text-ink-dim">
        Couldn't load fleet data: {loadError}
      </div>
    )
  }

  if (!fleet) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-soft text-sm text-ink-dim">
        Loading fleet…
      </div>
    )
  }

  const selectedAircraft = fleet.find((a) => a.id === selectedId) ?? null

  return (
    <div className="relative h-full w-full">
      <MapView
        fleet={fleet}
        predictions={predictions}
        hoveredId={hoveredId}
        // The popup is redundant while the sidebar's aircraft tab is open.
        selectedId={sidebarMode === 'aircraft' ? null : selectedId}
        onHoverAircraft={setHoveredId}
        onSelectAircraft={setSelectedId}
        onFullBreakdown={(id) => {
          setSelectedId(id)
          setSidebarMode('aircraft')
        }}
        onLiveUpdate={handleLiveUpdate}
      />

      <TopBar onOpenFleet={() => setSidebarMode('fleet')} />

      <Sidebar
        mode={sidebarMode}
        aircraft={selectedAircraft}
        fleet={fleet}
        predictions={predictions}
        liveEntries={liveEntries}
        onModeChange={setSidebarMode}
        onClose={() => setSidebarMode(null)}
        onSelectAircraft={(id) => {
          setSelectedId(id)
          setSidebarMode('aircraft')
        }}
      />

      <AnimatePresence>
        {showOnboarding && <Onboarding onComplete={() => setShowOnboarding(false)} />}
      </AnimatePresence>
    </div>
  )
}
