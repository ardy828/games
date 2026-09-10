# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

One browser game, a **single self-contained HTML file** — no build step, no dependencies, no
bundler, no package.json. `scrapline/index.html` (~2150 lines) holds its own markup, CSS and JS.
The repo root `index.html` is a landing page linking to it; `README.md` documents controls.

Nothing is compiled or transpiled. Editing a file *is* deploying it.

## Commands

There is no test suite, linter, or build. **This machine has no JS runtime** — no node, npm, deno or
bun — so `node --check` is unavailable and the only real verification is loading the page in a browser.

```bash
# run the game locally (localStorage misbehaves over file://, so use http://)
cd scrapline && python3 -m http.server 8000     # then open localhost:8000

# run from the repo root to get the landing page and click through to the game
python3 -m http.server 8000

# deploy: main is the GitHub Pages branch, served from /
git add -A && git commit -m "..." && git push   # live at ardy828.github.io/games/ in ~1 min
```

Before handing over an edit you cannot load in a browser, at minimum verify statically: bracket
balance with strings/comments stripped, that every `getElementById` id exists in the markup, and that
every called identifier is defined. A silent typo breaks the entire game, since it is one script
block.

## Publishing to Claude Artifacts

The local file is the **source of truth**. The Artifact copy is derived: strip the
`<!doctype>/<html>/<head>/<body>` wrapper (the artifact runtime supplies its own, and rejects the
tags), keeping everything from `<title>` through `</script>`. Never hand-edit a published copy —
regenerate it from the local file, or the two silently diverge.

The game guards its `window.claude.hot` calls, so it runs identically as a plain static page.

## Scrapline architecture

### Rendering pipeline

All game code draws in **logical pixels** into a fixed 384×240 offscreen canvas (`off` / `g`).
`present()` blits that to the visible canvas scaled up with smoothing disabled. Consequences worth
knowing before touching any drawing code:

- Sprite rotation happens at 1px resolution, which is *why* rotated sprites look chunky. Rendering
  sprites directly to the upscaled canvas instead would lose that look.
- `resize()` folds `devicePixelRatio` into the integer scale so backing pixels map 1:1 to device
  pixels. Don't set canvas dimensions anywhere else.
- Mouse input is divided back into logical space in `toLogical()`.
- `blit()` rounds translation to integers to keep the pixel grid aligned.

### Sprites

`MAPS` holds character maps, `P` maps characters to hex. `bake()` renders each to an offscreen canvas
once at boot. **`bake()` right-pads short rows to the longest row**, so making one row *longer* extends
the sprite — that is how the player's gun barrel and the spitter's nozzle protrude. Related tables that
must stay in sync:

- `PIV` — per-sprite pivot, in sprite pixels. Change a map's dimensions and you must update its pivot.
- `SPR.flash` — white silhouettes auto-generated for hit flashes.
- `SPR.hulk` — the **brute** map re-baked with `HULK_PAL` at 2×. Editing the brute changes the boss.

### Determinism

`startWave()` reseeds the global RNG from `(runSeed, waveNumber)`, so wave composition depends only on
those two values regardless of what happened during play — that is what makes the seed on the death
screen meaningful. Therefore:

- Use `rnd()` / `rr()` / `ri()` / `pick()` for anything that should reproduce from a seed.
- Use `Math.random()` for pure visual jitter (screen shake and arc jaggedness already do), so it never
  perturbs the stream.

### Upgrades are data, stats are derived

`lvl[id]` holds level counters. `recalc()` recomputes the entire `S` table from those counters, from
scratch, every time. All gameplay reads `S`. Never write a stat value into player state.

Adding an upgrade is three edits: a row in `UPGRADES`, a line in `recalc()`, and the code that consumes
it. `openUpgrades()`, `chooseUpgrade()` and the pause panel are generic over the table and need no
changes.

### Deferred death

Anything reducing `e.hp` **outside** the bullet loop — burn ticks, arc welder, shockwave rings, dash
strike — only subtracts. The sweep at the top of `updEnemies()` (`if (e.hp <= 0) killEnemy(e, i)`)
collects them next frame. Do not call `killEnemy()` from those paths: it splices by index and would
corrupt whatever loop you are in.

The boss is the same shape: `bossPick()` chooses an attack, a windup timer telegraphs it (the ring
colour in `render()` is keyed to `e.next`), then `bossFire()` executes it.

### UI split

Canvas draws only the game world. **Every menu, screen and HUD element is DOM**, overlaid on `#frame`,
which `resize()` sizes to match the canvas rect; `--ui` scales all overlay type with the arena.
`show(name)` toggles screens, where `null` means "playing". Adding a screen means adding to `SCREENS`
and the `el` id list.

### Touch controls

`TOUCH` is the single switch. It flips on at boot for `(hover:none) and (pointer:coarse)`, or on the
first `touchstart` anywhere, and everything else keys off it:

- `#pad` is a viewport-sized fixed overlay **outside `#stage`**, not inside `#frame`. That is deliberate:
  `#frame` is only as big as the canvas, so sticks parented to it would sit on the arena. From the
  viewport, the same CSS puts them in the side letterbox in landscape and in the dead space below the
  arena in portrait (where `#stage` switches to `align-items:start`).
- Both sticks **float** — `stickDown()` moves the base to wherever the thumb landed. `layoutPad()` caches
  each stick's home centre and radius from its zone rect, so it must run whenever the pad becomes visible
  (`syncPad()`) or the viewport changes (`resize()`); a hidden pad measures zero and is skipped.
- Each stick owns one `pointerId` and takes a pointer capture, so the two track independently and a drag
  that leaves the zone keeps working.
- `stickR.ang` is deliberately **not** reset on release, so the player keeps facing where you last aimed.
  `stickR.mag > 0` is the fire trigger — aim and fire are the same gesture.
- Touch reads into `updPlayer()` at exactly three points: movement (`stickL` overrides WASD), aim, and
  fire. Every desktop path is left byte-for-byte intact behind `TOUCH ?` guards.
- Dash with no move input is the one behaviour that genuinely differs: on touch it dashes along
  `player.ang` and stores that heading in `player.ddx/ddy` for the whole 0.16s, because there is no
  "hold a direction key while tapping" on a thumbstick.

Anything that strands a held control must call `releaseTouch()` — pause, blur, and `visibilitychange`
already do. Miss it and the player fires forever.

### Audio

Fully synthesised via Web Audio — no files, nothing fetched. `audioInit()` must be triggered by a user
gesture (browsers block audio otherwise); it is wired to the PLAY button and a capture-phase
`pointerdown`. **Gate anything that can fire many times per frame** with `gate(key, ms)` or a swarm
dying at once stacks dozens of voices into clipping.

## Conventions

The file is ES5 by choice — `var`, no arrow functions, no template literals — wrapped in a single
IIFE with `"use strict"`. Keep that style: it is commonly edited by exact-match string replacement,
and consistent syntax keeps those edits predictable.
