interface TopBarProps {
  onOpenFleet: () => void
}

/**
 * Floating top bar: a brand pill on the left, a "Fleet" shortcut on
 * the right that opens the sidebar's fleet-wide view directly.
 *
 * Args:
 *   onOpenFleet: Called when "Fleet" is clicked.
 *
 * Returns:
 *   The top bar.
 */
export function TopBar({ onOpenFleet }: TopBarProps): JSX.Element {
  return (
    <div className="absolute inset-x-4 top-4 z-30 flex items-start justify-between">
      <div className="rounded-full bg-white/90 px-4 py-2 shadow-floaty backdrop-blur">
        <span className="text-sm font-semibold text-ink">JetBoost Flight Deck</span>
        <span className="ml-2 text-xs text-ink-dim">CMAPSS demo</span>
      </div>
      <button
        onClick={onOpenFleet}
        className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-ink shadow-floaty backdrop-blur transition hover:bg-white"
      >
        Fleet
      </button>
    </div>
  )
}
