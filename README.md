# Games

A browser game in a **single self-contained HTML file** — no build step, no dependencies,
no bundler. Open the file in a browser and it runs.

**▶ Play it: <https://ardy828.github.io/games/>**

| Game | Type | Play | Folder |
|---|---|---|---|
| **Scrapline** | Top-down arena shooter | [Play](https://ardy828.github.io/games/scrapline/) | [`scrapline/`](scrapline/) |

## Scrapline

Hold a scrapyard against malfunctioning salvage drones converging from every bearing.

- **Controls (desktop)** — WASD to move, mouse to aim, hold click to fire, Space to dash, Esc to pause, M to mute.
- **Controls (touch)** — twin sticks: the left one moves, the right one aims and fires while deflected,
  and the dash button sits beside the fire stick. Both sticks float, so they plant wherever your thumb
  lands rather than at a fixed spot. Pause is the button in the top-right corner. Touch controls switch
  themselves on for coarse pointers; landscape gives the larger arena, portrait keeps the sticks off it.
- Fixed 384×240 logical resolution, integer-scaled to the window so the pixels stay square at any size.
  Sprites are authored as character maps in the source and baked to canvases at boot.
- Six enemy types unlock on a schedule; a hulk boss every tenth wave picks between a charge, a ground
  slam, a flak ring and mortar strikes.
- Waves are generated from a growing point budget plus a random modifier (SWARM, ARMORED, FRENZY,
  VOLATILE, PACK, MIST). Each wave reseeds from `(runSeed, waveNumber)`, so the seed shown on the death
  screen reproduces that run's wave layouts.
- 26 upgrades, three offered after each wave. Your build and its derived stats are listed on the pause screen.
- All audio is synthesised at runtime with the Web Audio API — no audio files.

## Running locally

```bash
cd scrapline
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Opening the file directly over `file://` mostly works, but
`localStorage` behaves inconsistently there, so the high scores are more reliable over `http://`.

## Hosting

Live on GitHub Pages at <https://ardy828.github.io/games/>, served from the root of `main` —
pushing to `main` deploys.

Plain static HTML — any static host will serve it unchanged. Drop the folder on Cloudflare
Pages or Netlify, or upload `index.html` to the web root of any shared host.
