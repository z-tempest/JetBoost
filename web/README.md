# Engine Flight Deck

Synthetic CMAPSS fleet visualization. React + TypeScript + Vite + Tailwind + react-three-fiber.

## Setup

```bash
npm install
npm run dev
```

## Notes

- All fleet data is generated client-side in `src/data/generateFleetData.ts` (seeded, so it's stable across reloads). Swap in `src/api/client.ts`'s `fetchFleet()` once a real FastAPI/MLflow backend is serving CMAPSS predictions — same shape, see `src/types/fleet.ts`.
- `vite.config.ts` deliberately pins `@vitejs/plugin-react` to v4.x with no `babel: {}` option, to avoid the `@rolldown/plugin-babel` peer-dependency split that ships in plugin-react v6+ (only bites you if you're on rolldown-vite and pass babel options into `react()`).
- Imports are extension-less throughout (`from '../utils/path'`, not `'../utils/path.js'`) — TS's `bundler` module resolution handles `.ts`/`.tsx` resolution itself, so renaming a file won't silently break an import elsewhere.
