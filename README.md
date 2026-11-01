# Rugged Lynx Trail Cam Co. — RL-1 site

Two pages sharing one header and footer:

- `/`: marketing page with a scroll-driven 3D teardown of the RL-1 trail camera.
- `/netlynx` (and `/netlynx/:zip`): NetLynx, a ZIP-to-sector location tool with a 3D globe and four data panels.

Vite + React + TypeScript, three.js via @react-three/fiber/drei, GSAP ScrollTrigger + Lenis.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ locally
```

## Edit copy and specs

Everything a visitor reads (headline, stats, chapter copy, specs, callout labels, stamp text)
is in `src/content.ts`. All numbers are placeholders.

## Where things live

| Path | What |
| --- | --- |
| `src/three/CameraModel.tsx` | The procedural camera, one group per part, 1 unit = 1 cm |
| `src/three/timeline.ts` | Per-chapter keyframes (part offsets, opacity, door angle, camera framing) |
| `src/three/rig.tsx` | Applies the pose each frame, camera fit, drag, callout projection |
| `src/three/textures.ts` | Canvas textures: PCB + signal map, chip tops, Fresnel, AA wraps |
| `src/ui/Stage.tsx` | Pinned stage: cards, rail, callouts, trail-cam stamp |
| `public/brand/` | Logos as supplied, `*-trimmed.svg` copies (viewBox only), chip lid art, product photo |
| `public/textures/` | Generated camo, topo lines, torn-edge mask (`npm run textures` to regenerate) |

`npm run shots` (with the dev server running) screenshots every chapter at 1440×900 and 390×844 into `screenshots/`.

## NetLynx

| Path | What |
| --- | --- |
| `src/netlynx/NetLynxPage.tsx` | Page: search, lock-on phases, layout, aria-live announcements |
| `src/netlynx/globe/` | Custom R3F globe: land texture, borders, sector hex, bird dots, shaded relief |
| `src/netlynx/api/` | Typed clients; `http.ts` handles 10-minute caching, timeouts and error kinds |
| `src/netlynx/panels/` | Conditions, Birds, Local game, Terrain (each loads on its own) |
| `src/netlynx/data/game.ts` | Curated game species, cam tips, peak windows, state agency links |
| `src/netlynx/notes.ts` | Rule-based hunt notes |
| `src/netlynx/content.ts` | All NetLynx copy |
| `api/ebird.ts` | Vercel function that holds the eBird key; Vite runs it locally too |

Data sources: Zippopotam.us, Open-Meteo (forecast + elevation), eBird API 2.0 (via `/api/ebird`),
iNaturalist, OpenStreetMap Overpass, USGS PAD-US.

### Secrets

Copy `.env.example` to `.env.local` and fill in:

```
EBIRD_API_KEY=...        # https://ebird.org/api/keygen
```

It isn't `VITE_`-prefixed, so it never reaches the browser bundle. `npm run dev` and `npm run preview`
serve `/api/*` from the files in `api/` with this variable, so local behaves like Vercel.

`node scripts/netlynx-shots.mjs http://localhost:5173` screenshots NetLynx before and after searches.

## Deploy


- **Vercel (recommended, needed for `/api`):** import the repo, framework preset “Vite”, build `npm run build`,
  output `dist`. `vercel.json` rewrites page routes to `index.html`; files in `api/` deploy as functions.
  Add `EBIRD_API_KEY` under Project → Settings → Environment Variables
  (Production and Preview), then redeploy. CLI: `npx vercel env add EBIRD_API_KEY`.
- **Netlify:** the landing page and most of NetLynx work as a static site, but the `/api` functions are Vercel-style,
  so the birds panel needs porting to Netlify Functions.
