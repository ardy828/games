# Games

Two browser games. Each is a **single self-contained HTML file** — no build step, no
dependencies, no bundler. Open the file in a browser and it runs.

| Game | Type | Folder |
|---|---|---|
| **Scrapline** | Top-down arena shooter | [`scrapline/`](scrapline/) |
| **Challenger Deep** | Sliding number puzzle | [`challenger-deep/`](challenger-deep/) |

## Scrapline

Hold a scrapyard against malfunctioning salvage drones converging from every bearing.

- **Controls** — WASD to move, mouse to aim, hold click to fire, Space to dash, Esc to pause, M to mute.
- Fixed 384×240 logical resolution, integer-scaled to the window so the pixels stay square at any size.
  Sprites are authored as character maps in the source and baked to canvases at boot.
- Six enemy types unlock on a schedule; a hulk boss every tenth wave picks between a charge, a ground
  slam, a flak ring and mortar strikes.
- Waves are generated from a growing point budget plus a random modifier (SWARM, ARMORED, FRENZY,
  VOLATILE, PACK, MIST). Each wave reseeds from `(runSeed, waveNumber)`, so the seed shown on the death
  screen reproduces that run's wave layouts.
- 26 upgrades, three offered after each wave. Your build and its derived stats are listed on the pause screen.
- All audio is synthesised at runtime with the Web Audio API — no audio files.

## Challenger Deep

A 2048-style slider where every tile is a depth in metres and merging drives you down an ocean trench.
The gauge shows your deepest tile and the pressure at that depth in atmospheres; the rail highlights
which real ocean zone you're in, from the sunlight zone down to the hadal trenches.

- **Controls** — arrow keys or WASD, swipe on touch. `R` for a new dive, `U` to undo.

## Running locally

```bash
cd scrapline          # or challenger-deep
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Opening the file directly over `file://` mostly works, but
`localStorage` behaves inconsistently there, so the high scores are more reliable over `http://`.

## Hosting

Both are plain static HTML — any static host will serve them unchanged. Drop a folder on Cloudflare
Pages or Netlify, or upload `index.html` to the web root of any shared host.
