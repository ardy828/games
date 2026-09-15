# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Browser games, each a **single self-contained HTML file** — no build step, no dependencies, no
bundler, no package.json. The one external script is PeerJS, which Scrapline injects from cdnjs only
when the player presses CO-OP; solo play never loads it. `scrapline/index.html` (~3000 lines) and `blockblast/index.html`
(~970 lines) each hold their own markup, CSS and JS. The repo root `index.html` is a landing page
linking to them; `README.md` documents controls.

`flatcraft/index.html` is the other exception: it loads Three.js r128 (the last UMD build) from cdnjs at
boot, since a voxel renderer without WebGL helpers is not worth hand-rolling. It also injects the same
PeerJS build as Scrapline, only when the player hosts or joins a multiplayer room.

Nothing is compiled or transpiled. Editing a file *is* deploying it.

## Commands

There is no test suite, linter, or build. **This machine has no JS runtime** — no node, npm, deno or
bun — so `node --check` is unavailable and the only real verification is loading the page in a browser.

```bash
# run from the repo root to get the landing page and click through to a game
# (localStorage misbehaves over file://, so use http://)
python3 -m http.server 8000                     # then open localhost:8000

# deploy: main is the GitHub Pages branch, served from /
git add -A && git commit -m "..." && git push   # live at ardy828.github.io/games/ in ~1 min
```

Firefox *is* installed, and headless it is the only way to actually execute this code:

```bash
python3 -m http.server 8000 &
firefox --no-remote --profile /tmp/prof --headless --window-size=430,900 \
        --screenshot /tmp/shot.png http://localhost:8000/blockblast/
```

The screenshot fires on `load`, which usually beats the first `requestAnimationFrame`, so a
plain shot of a canvas game is often blank. To see real output, copy the file, expose the
internals you need on `window`, drive the game with synthetic `PointerEvent`s **synchronously**
at parse time, print results into a DOM element, and call the game's own `draw()` before the
script ends. Delete the copy afterwards — no debug hooks ship.

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
  pixels — except on touch, where the scale is fractional so the arena fills the phone (whole-number
  steps at a 2.6 DPR waste a quarter of the width). Don't set canvas dimensions anywhere else.
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

### Co-op: player contexts and netcode

Two-player online co-op is host-authoritative. The design rests on one trick: **the sim still reads
the globals `player`, `lvl`, `S`, `drones`, `sentries`, `offers`, `inp`**, and `bind(i)` points those
names at player `i`'s context in `PL[]` before that player's slice runs. Solo is `PL.length === 1`, so
`bind(0)` is a no-op and no gameplay function had to change shape. Rules that follow from it:

- Any function that reads `player` or `S` must be called with the right context bound. The loop binds
  per player around `updPlayer`/`updDrones`; `updEnemies` binds `nearestP()` per enemy (that player is
  chased, shot and bitten); `updBullets` binds `b.own` (the shooter's stats); enemy projectiles loop
  over every non-down context. `bind(local)` runs before `syncHud()`/`render()`.
- Reassigning one of those arrays must also store it back (`sentries = PL[i].sentries = []`), or the
  context keeps the old one.
- Kill credit (`streak`, `refund`, `nova`) goes to `e.by`, set in `hitEnemy` and dash strike. Ring kills
  fall to player 0.
- Input is one `inp` object per context from `readInput()`; the joiner's is whatever last arrived.
- Death is shared: `hurtPlayer` calls `downPlayer()`, which only calls `gameOver()` once every context
  is down. `startWave()` revives everyone.
- Upgrades: `openUpgrades()` rolls offers per context, `chooseUpgrade()` records a pick,
  `tryApply()` applies all and starts the wave once nobody has `pick < 0`.

Netcode lives in one section above the main loop. The host sends a snapshot every other frame
(`netSnapshot`, field lists in `F`, numbers rounded to 0.1); the joiner writes it straight into the
globals `render()` reads (`applySnapshot`) and runs no sim, only `clientTick` (input, projectile
coasting, `updStuff`). Side effects the sim produces go through `fx()` — `burst`, `addFloat`,
`addShake`, `scorch`, `bannerText`, the red flash and every `SFX.*` (wrapped on host start) — and
are replayed on the joiner, so the particle array never ships. Screen changes ride on `show()`
(`{t:"st"}`). Joiner → host messages: `i` input, `pick`, `pause`, `again`. A closed connection
ends the run on both sides via `gameOver()` (its eyebrow already says SIGNAL LOST). The room code
is the host's PeerJS id (`"scrapline-" + code`); an `unavailable-id` error rerolls it.

## Flatcraft architecture

A Three.js voxel sandbox: 500×500 world, 256 build height, value-noise terrain.

- **Blocks** are rows in `DEFS` (`key`, name, tiles, flags); `B.key` gives the id and `BLOCKS[id]` the
  definition. Tiles are listed per face in the order +X −X +Y −Y +Z −Z (matching `FACES`); a single
  name fills all six. Flags: `transparent` (faces against it are drawn), `liquid` (water: not solid,
  meshed separately). Every block breaks, bedrock included (creative is the only mode). Each tile is a painter in `painters`, rendered into a one-row
  atlas at boot; adding a block is one `def()` and one `DEFS` row, and the picker builds itself.
  **Append new rows at the end of `DEFS`**: a block's id is its row index, and saved edits and
  multiplayer messages store ids, so inserting a row mid-table changes blocks in existing worlds.
  To show a block elsewhere in the picker, flag its row `after: 'key'` (Pink Wool sits after Purple).
- **Terrain** is pure functions of position. `terrainHeight(x, z)` is rolling hills + bumps, plus
  `mountainMask()` (a smoothed large-scale noise, 0 on the plains and 1 in a range) times ridged
  noise for peaks up to ~170, minus basins for lakes (suppressed inside ranges; water fills to
  `WATER_LEVEL`). Surface material comes from the height: grass, then bare stone above `STONE_LINE`
  (96), then snow above `SNOW_LINE` (118), each jittered by a few blocks so the lines are not rings.
  `caveAt(x, y, z)` carves in 3D: two crossing `vnoise3` sheets make tunnels and a third noise below
  y 44 opens caverns; bedrock and the two blocks under a lake bed are never carved, so water never
  hangs over air. `treeAt()` gives one candidate tree per 9×9 cell, thinned by a forest field and
  absent above the stone line; `hash3()` places ore. Everything is deterministic from `SEED`, which
  is set per world by `enterWorld()` (so it is a `let`, as is `RENDER_DIST`, which the options drive).
  A world whose index entry has `flat: true` sets `FLAT`: `terrainHeight()` returns `FLAT_H` (3),
  and `generateChunk()` fills each column with bedrock, dirt and grass, with no caves, ore, water or
  features. The host sends `flat` in `{t:'w'}` so joiners generate the same ground.
- **Features** (`FEATURES`) are stamped after the columns: each row owns a grid of `cell`×`cell`
  columns, `at(gx, gz)` decides whether that cell spawns one and where, `place(feature, put)` writes
  blocks through a `put` that drops anything outside the chunk, and `reach` is how far it extends
  from its anchor so neighbouring chunks regenerate it and it crosses borders seamlessly. Trees are
  the only row; a structure (hut, ruin, dungeon) is one more row, and it should read ground with
  `terrainHeight()`, not the chunk data, so every chunk it touches agrees on where it sits.
- **Chunks** are 16 columns × 16 × 256 `Uint8Array`s in `chunkData`, generated on demand by
  `generateChunk()` (columns with caves, then features, then the chunk's saved edits), and evicted
  a few rings beyond render distance. `groundY()` scans down from `terrainHeight()` through any cave
  opening to find the real spawn surface. `getBlock()` reads
  through it, so terrain outside loaded chunks is generated transparently (and cached) when a chunk
  edge or raycast needs it. `maxY` per chunk bounds the meshing loop.
- **Edits** live in `edits` (chunk key → Map of cell index → id) and are written into the chunk data
  as well; `saveWorld()` serialises them plus the player's position on a short debounce, and
  `enterWorld()` restores them via `applyEdits()` before any chunk is generated.
- **Worlds & storage**: `flatcraft.worlds.v1` is the index (`{id, name, seed, created, played}`, capped
  at `MAX_WORLDS` = 5), each world's state is `flatcraft.world.<id>`, options are `flatcraft.options.v1`.
  The old single save `flatcraft.edits.v2` is migrated into "World 1" once at boot and removed. The
  game reads and writes a world only through a *world source* (`load()`, `save(state)`, `flush()`);
  `LocalWorldSource` backs your own worlds, and a joiner gets an inline source whose `load()` returns
  what the host sent and whose `save()` does nothing. `enterWorld(w, src)` takes it as the optional
  second argument. `source` is `null` while in the menu, and `frame()` skips the world update until
  one is set.
- **Multiplayer** is host-authoritative over PeerJS (one section above the main loop). The host
  presses Open to Friends on the pause card (`openRoom()`); the room code is the peer id
  `"flatcraft-" + code`. `welcome()` sends a joiner every edit as `{t:'e'}` messages (sliced to
  `EDIT_SLICE` numbers, because PeerJS rejects JSON messages over ~16 KB) followed by `{t:'w'}` with the
  seed and the host's pose, and the joiner enters the world from that. **Every local change goes
  through `editBlock()`**, which calls `setBlock()` and sends `{t:'b'}`; the host applies a joiner's edit
  and echoes it to everyone, the sender too, so simultaneous edits converge. Only the receive paths
  call `setBlock()` directly. Poses travel at 20 Hz on a `setInterval` (not the frame loop, so hidden
  tabs keep the link alive) and double as the heartbeat: `NET_TIMEOUT` of silence drops a link.
  Other players are `remotes` (a box body, a pitching head and a `nameTag()` sprite drawn without
  depth test), eased toward their last pose in `updateRemotes()`. `leaveWorld()` calls `closeNet()`,
  so quitting or switching worlds closes the room.
- **Names & chat**: the name lives in `#mpName` (saved under `flatcraft.name.v1`). A joiner sends it
  as PeerJS connection `metadata`; the host keeps `names` (id → name, 0 is the host) and broadcasts
  the whole list as `{t:'n'}` on every join, before the newcomer's first pose, so a tag is always
  built with its name. Chat is `{t:'c', s}` to the host, echoed to everyone as `{t:'c', id, s}`; no
  `id` means a system line (joined / left). All text goes through `clean()` and into the DOM via
  `textContent`, never `innerHTML`. The chat box (`T`) releases pointer lock like the picker does,
  and `chatOpen` keeps the pause card from appearing meanwhile.
- **Screens**: `#overlay` holds `#menu` (Worlds / Options / Multiplayer tabs) and `#pause`, whose room
  button and status line `roomUi()` keeps in sync with the network state. Losing pointer
  lock inside a world shows the pause card; `leaveWorld()` saves and `clearWorldState()` drops every
  chunk, so switching worlds needs no reload. `body.in-menu` hides the HUD.
- **Meshing**: `buildChunk()` emits only faces whose neighbour is air or a *different* transparent
  block, into a solid buffer (alpha-tested, for glass/leaves/ice) and a water buffer (translucent,
  double-sided, top face lowered to 0.875). Per-face brightness is baked into vertex colours; no lights.
  `setBlock()` marks the chunk dirty (and the neighbour when on a chunk edge); `rebuildDirty()`
  rebuilds the same frame.
- **Player**: swept AABB moved one axis at a time in ≤0.25 steps (`moveAxis`), water is non-solid and
  applies its own gravity/buoyancy, the player is clamped to the world edge. `raycast()` is a voxel
  DDA from the camera that skips water and returns the hit block plus the face normal.
- **Picker**: `E` releases pointer lock and shows `#picker`; clicking a cell writes into `hotbar[selected]`
  and re-requests the lock. `pickerOpen` keeps the pause card from appearing during that unlock.
- Flatcraft uses modern syntax (`const`, arrows, template literals); the ES5 rule below applies to
  Scrapline only.

## Conventions

The file is ES5 by choice — `var`, no arrow functions, no template literals — wrapped in a single
IIFE with `"use strict"`. Keep that style: it is commonly edited by exact-match string replacement,
and consistent syntax keeps those edits predictable.

## Block Blast architecture

An 8x8 grid, three pieces in a tray, drag them in; a full row or column clears. Everything is one
canvas — the only DOM is two icon buttons and the game-over panel, positioned from `layout()`.

### Layout is derived from one number

`layout()` solves for `u`, the cell size, from the viewport: header + board + gap + tray is a fixed
`UNITS` tall in multiples of `u`, so the whole screen scales from that one value and every position
in the file is written as a multiple of it. Change a vertical proportion and you must change `UNITS`
to match, or the layout stops being centred.

Phones (`W < 500`) are width-bound, so there the side margin shrinks to just the board frame's lip and
tray pieces draw at `pieceK` = 0.7u instead of 0.58u, using the spare height.

### Board coordinates vs screen coordinates

`draw()` translates to `boardX, boardY` before drawing the board, so cells, ghosts, sweeps, bursts
and floats are all in **board-local pixels** (`x*u`, not `boardX + x*u`). The tray and the piece in
hand are drawn after `g.restore()`, in screen pixels. Mixing the two is the easy mistake here.

### Draw order carries the line highlight

The rows and columns a drop would clear are drawn **twice**: once under the cubes (`glowLine`, which
fills the empty cells) and once over them with `globalCompositeOperation = "lighter"`, which is what
makes already-placed blocks in that line glow. Drawing it only once, underneath, is invisible — the
cubes cover it. Both passes use `COLORS[drag.col]`, and so does the `sweeps` animation on the actual
clear: the line always lights up in the colour of the piece that filled it.

### Cleared cells leave the grid immediately

`place()` writes the piece, reads back full lines, then sets those cells to `-1` **and** pushes a
copy of each into `clears` as a purely visual overlay. Game logic therefore never waits on an
animation, and nothing may read `grid` expecting a clearing cell to still be there.

### Dealing is checked, not random

`refill()` rerolls up to 40 times until at least one of the three pieces fits the current board, then
falls back to picking a shape that provably fits. Removing that check makes the game deal unplayable
hands. `fitsAnywhere()` also greys out a tray piece that has nowhere left to go.

### Audio

Same approach as Scrapline: fully synthesised Web Audio, `audioInit()` on the first pointer down.
Every impact is an oscillator with an exponential envelope plus a filtered `noiseBuf` burst, through
a shared compressor so stacked line-clear voices cannot clip. `SCALE` is a C pentatonic — clears
play one note per line and start higher as the combo climbs, which is why they resolve rather than
just get louder.
