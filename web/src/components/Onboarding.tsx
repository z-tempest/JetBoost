import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface OnboardingProps {
  onComplete: () => void
}

interface Slide {
  title: string
  body: string
}

const SLIDES: Slide[] = [
  {
    title: 'Welcome to JetBoost Flight Deck',
    body: "Each aircraft on the map isn't a real flight, it's a synthetic flight path programatically generated using the turbofan engine operational settings data from the NASA CMAPSS FD004 test set.",
  },
  {
    title: 'Color is health',
    body: 'Green, amber, and red mark healthy, warning, and critical predicted remaining useful life (RUL).',
  },
  {
    title: 'Click any aircraft',
    body: 'See its operating settings and predicted RUL at a glance, or open the full sensor breakdown and fleet view.',
  },
]

/**
 * Full-screen onboarding overlay: a short sequence of animated slides
 * shown over the main UI on load, dismissible at any point.
 *
 * Args:
 *   onComplete: Called when the user finishes or skips.
 *
 * Returns:
 *   The overlay.
 */
export function Onboarding({ onComplete }: OnboardingProps): JSX.Element {
  const [index, setIndex] = useState<number>(0)
  const isLast = index === SLIDES.length - 1

  return (
    <motion.div
      className="absolute inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        className="w-[380px] overflow-hidden rounded-xl2 bg-white p-6 shadow-panel"
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <div className="relative h-32">
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ x: 24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -24, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="absolute inset-0"
            >
              <h2 className="text-lg font-semibold text-ink">{SLIDES[index].title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-dim">{SLIDES[index].body}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1.5">
            {SLIDES.map((_, i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full transition ${i === index ? 'bg-accent' : 'bg-black/10'}`} />
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={onComplete} className="text-sm font-medium text-ink-dim transition hover:text-ink">
              Skip
            </button>
            <button
              onClick={() => (isLast ? onComplete() : setIndex((i) => i + 1))}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90"
            >
              {isLast ? 'Get started' : 'Next'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
