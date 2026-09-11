# Games

Browser games, each one a **single self-contained HTML file** — no build step, no dependencies,
no bundler. Open the file in a browser and it runs.

**▶ Play them: <https://ardy828.github.io/games/>**

| Game | Type | Play | Folder |
|---|---|---|---|
| **Block Blast** | 8×8 block puzzle | [Play](https://ardy828.github.io/games/blockblast/) | [`blockblast/`](blockblast/) |
| **Scrapline** | Top-down arena shooter | [Play](https://ardy828.github.io/games/scrapline/) | [`scrapline/`](scrapline/) |

## Block Blast

Drag pieces from the tray onto an 8×8 grid. Fill a whole row or column and it blasts away.
The game ends when none of the three pieces in the tray fit anywhere.

- **Controls** — drag a piece onto the grid with the mouse or a finger; it snaps to the grid
  while it is over a legal spot. On touch the piece rides a cell above your thumb so you can
  see where it lands. `M` mutes, `R` starts a new game; both also have buttons.
- 42 block shapes: bars up to five long, squares, corners, S/Z, T, J/L, a plus and diagonals.
  Each piece is dealt in one of eight colours.
- **The lines you are about to clear light up in the colour of the piece you are holding**, and
  the clear itself sweeps down that row or column in the same colour before the cubes burst apart.
- Clearing several lines in one drop scores more, and clearing on consecutive drops builds a combo
  multiplier. A drop that clears nothing resets the combo.
- A fresh hand is checked against the board, so you are not dealt three pieces that cannot be played.
- All audio is synthesised at runtime with the Web Audio API — no audio files. The high score is
  kept in `localStorage`.

## Scrapline

Hold a scrapyard against malfunctioning salvage drones converging from every bearing.

- **Controls (desktop)** — WASD to move, mouse to aim, hold click to fire, Space to dash, Esc to pause, M to mute.
- **Controls (touch)** — twin sticks: the left one moves, the right one aims and fires while deflected,
  and the dash button sits beside the fire stick. Both sticks float, so they plant wherever your thumb
  lands rather than at a fixed spot. Pause is the button in the top-right corner. Touch controls switch
  themselves on for coarse pointers; landscape gives the larger arena, portrait keeps the sticks off it.
- Fixed 384×240 logical resolution, integer-scaled to the window so the pixels stay square at any size
  (touch screens scale fractionally instead, so the arena fills the phone).
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
python3 -m http.server 8000     # from the repo root, for the landing page
```

Then open <http://localhost:8000>. Opening a file directly over `file://` mostly works, but
`localStorage` behaves inconsistently there, so the high scores are more reliable over `http://`.

## Hosting

Live on GitHub Pages at <https://ardy828.github.io/games/>, served from the root of `main` —
pushing to `main` deploys.

Plain static HTML — any static host will serve it unchanged. Drop the folder on Cloudflare
Pages or Netlify, or upload the files to the web root of any shared host.
