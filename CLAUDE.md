# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Browser games, each a **single self-contained HTML file** — no build step, no dependencies, no
bundler, no package.json. The one external script is PeerJS, which Scrapline injects from cdnjs only
when the player presses CO-OP; solo play never loads it. `scrapline/index.html` (~3000 lines) and `blockblast/index.html`
(~970 lines) each hold their own markup, CSS and JS. The repo root `index.html` is a landing page
linking to them; `README.md` documents controls.

`obito/index.html` (Obito's Multiverse, ~1650 lines) is another single-file game: modern syntax, canvas
plus DOM menus, Google Fonts, progress in `localStorage` (`obito-multiverse-save-v1`). It was written
as a Claude Artifact, so it guards its `window.claude.hot` calls and runs unchanged as a static page.
Touch support is one section after the keyboard input: `TOUCH` (set via the `tui` body class, since
`.touch` was already a class), a floating stick read in `updatePlayer()`, and `#pad` buttons that
write the same `keys`/`hit` tables as the keyboard. `syncPad()` runs each frame: outside a fight the
pad hides and a tap anywhere presses Enter. Obito's spiral mask is drawn after the hair (`late` in
`drawPerson()`), with its eye hole on the left, matching the landing-page icon. The bob and long side
locks are drawn by `drawLocks()` before the face and turn with the head (the near lock thins and tucks
in), so a turned head never hides an eye; `drawHair()` only draws them from behind.
The canvas is not a fixed 960x540 bitmap: `fitCanvas()` (on resize and a `ResizeObserver`) sizes the
backing store to the displayed size times `devicePixelRatio`, capped at 3x, and sets `DPR` to that
scale; all drawing stays in 960x540 logical units through `setTransform(DPR)`. Map grounds are cached
once at the sharpest scale within a 6M-pixel budget. `sharingan()` draws the three-tomoe eye (the
tomoe spin; below about 5 screen pixels it is just iris, rim and pupil). Easy mode is `save.easy`, picked
in the creator; `easy(k)` returns the `EASY` multiplier or 1, applied in `makePlayer()` (health and
chakra), the chakra regen line in `updatePlayer()` and `hurtPlayer()` (damage taken).
The story is the `ORDER` list (one `startChapter()` entry and one debug-menu `DBG` row per chapter, in
the same order; `grantFor()` unlocks powers by index). Between Sukuna and the final chapter is a One
Piece arc: the Sunny (`ship` map), a Marine ambush on the `cove` map with Luffy, Zoro and Sanji as allies
(their specials are in `updateAlly()`), the Kabuto boss (`kabutoThink`; hitting him mid-heal stops the
Mystical Palm) and the Kaido cutscene that ends in Luffy's throw. A cutscene actor with `rot` is drawn
lying down.

`flatcraft/index.html` is the other exception: it loads Three.js r128 (the last UMD build) from cdnjs at
boot (and carries its texture art inline as one base64 PNG strip), since a voxel renderer without WebGL helpers is not worth hand-rolling. It also injects the same
PeerJS build as Scrapline, only when the player hosts or joins a multiplayer room.

Nothing is compiled or transpiled. Editing a file *is* deploying it.

Every page (the landing page and each game) ends with the same **lockdown** block: CSS that turns off
selection, long-press callouts, image dragging and overscroll, and a script that cancels the right-click
menu, copy/cut, selectstart, dragstart, pinch and Ctrl zoom and Ctrl+S/U/P/A/C/X, and cancels a
second `touchend` within 350 ms, since iPhones ignore `user-scalable=no` and double-tap zoom otherwise
(gameplay reads taps on `pointerdown`, so only a fast second click on a menu button is lost). Text fields are
exempt. Keep the copies identical; a new game gets the same block. The landing page still scrolls
vertically (`touch-action: pan-y`), since its cards run past a phone screen.

## Commands

There is no test suite, linter, or build. Node is available through nvm, so `node --check` on the
extracted script catches syntax errors, but the only real verification is loading the page in a browser.

```bash
# run from the repo root to get the landing page and click through to a game
# (localStorage misbehaves over file://, so use http://)
python3 -m http.server 8000                     # then open localhost:8000

# deploy: main is the GitHub Pages branch, served from /
git add -A && git commit -m "..." && git push   # live at ardy828.github.io/games/ in ~1 min
```

**Work directly on `main`.** Do not create branches (feature, `claude/...` session branches or
otherwise) unless the owner asks for one: commit to `main` and push to `main`. If a session starts
on a branch, push the commits to `main` (`git push origin HEAD:main`) and leave no branch behind.

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
(`{t:"st"}`). Joiner → host messages: `i` input, `pick`, `pause`, `again`. The room code
is the host's PeerJS id (`"scrapline-" + code`); an `unavailable-id` error rerolls it, but only
before the room has opened (a signalling reconnect by `keepSignal()` reuses the id).

The link is built for bad Wi-Fi, and Flatcraft uses the same scheme:

- **Two lanes.** `netSend()` uses PeerJS's reliable ordered channel, for anything that must land.
  `netStream()` uses `net.fast`, a second channel that `openFast()` creates on the same
  RTCPeerConnection (negotiated, `id: FAST_ID`, unordered, no retransmits). It carries the snapshot,
  input and heartbeat (`hb`) streams. Stream messages carry a sequence number `q`, and the receiver
  drops anything older than `net.rq`. When either lane has more than `NET_BACKLOG` bytes queued,
  stream messages are skipped, never queued. Until something arrives on the partner's fast channel
  (`fastOk`), streams are sent on both lanes, so a browser without the second channel still works.
  Wave banners are taken out of the snapshot's fx and sent reliably as `{t:"fx"}`.
- **PeerJS `error` events are not fatal.** A JSON message over ~16 KB raises one on an open
  connection. Only `close`, or an error once `!conn.open`, counts as a drop.
- **Drops.** A drop is a `close`, or `NET_TIMEOUT` of silence. On a drop during a run, `netLost()`
  sets `net.away` and does not end the run. The loop freezes and `#netwarn` counts down. The joiner
  `redial()`s with a fresh peer every 5 s. The host accepts the next connection and `resync()`s it
  (`go` with `re`, then `st` or the upgrade offers). After `NET_GRACE`, `netGiveUp()` ends the run
  via `gameOver()`, whose eyebrow says SIGNAL LOST. `#netwarn` also shows WEAK SIGNAL after 1 s of
  silence.
- **Quitting** sends `bye` (`netClose()` destroys the peer 300 ms later so it can leave), so the
  partner ends at once instead of waiting out the grace period.

## Flatcraft architecture

A Three.js voxel survival sandbox: an effectively infinite world (border at ±30M, like Minecraft), 256 build height, value-noise terrain and biomes,
survival and creative modes. One IIFE, sections in this order: registries, textures, terrain, chunk
storage, saving, meshing and sky, audio, physics and player, inventory and furnaces, mobs, drops,
interaction, UI, multiplayer, main loop.

- **Blocks** are rows in `DEFS` (`key`, name, tiles, flags); `B.key` gives the id and `BLOCKS[id]` the
  definition. Tiles are listed per face in the order +X −X +Y −Y +Z −Z (matching `FACES`); a single
  name fills all six. Flags: `transparent` (does not hide faces or block light), `liquid` (water),
  `solid: false` (walk-through), `shape: 'cross' | 'torch' | 'bed'` (plants, torches, beds),
  `height` (collision and mesh height below 1, read through `HGT`), `light` (block light
  level), `tint: 'top' | 'all'` (multiplied by the biome colour), `replace` (placing into it replaces
  it). `OPQ`, `SOLID` and `LIGHT_OF` are per-id lookup arrays derived from the flags.
  **Append new rows at the end of `DEFS`**: a block's id is its row index, and saved edits and
  multiplayer messages store ids, so inserting a row mid-table changes blocks in existing worlds.
  To show a block elsewhere in the picker, flag its row `after: 'key'`. To retire a block, flag its
  row `hidden: true` instead of deleting it (Glowstone and Netherrack).
- **Facing blocks**: `ball()` and `facing()` expand to four consecutive rows (`dir` 0..3 = +Z, +X, −Z,
  −X), only the first in the picker. `placeBlock()` adds the snapped yaw to the id for any row with
  `dir` (turned 180° with Shift), and `baseOf(id)` maps any facing row back to the first. Balls are
  meshed as spheres by `addBall()`; the furnace (and its lit twin) is a cube with one front tile.
- **Items**: ids 0..255 are blocks (a block is its own item), 256+ are `ITEMS` rows made with `item()`,
  looked up as `I.key`. Props: `food: [hunger, saturation]` (plus `heal`, health restored, and
  `always`, edible when full, on the golden apple), `fuel` (seconds), `tool: {kind,
  tier, speed, dur, dmg}`, `armor: {slot, pts, dur}`; tools are generated from `TIERS` ×
  `TOOL_KINDS`, armour from `ARMOR_TIERS` × `ARMOR_SLOTS`. **Append new items after the generated
  tools and armour**: an item id is its position in `ITEMS`, and saves store ids. `durOf()` covers
  tools and armour. Inventory stacks are
  `{ id, n, d }` (`d` is tool wear). `SMELT` maps input → output, `FUEL` id → seconds.
- **Mining**: `PROPS` (built by `prop()`) gives each block hardness, preferred tool, harvest tier,
  sound material and drop (omitted = itself, `null` = nothing, a function = `[[id, n]]`). Hardness
  −1 is unbreakable in survival. `breakTime()` follows Minecraft's formula; `canHarvest()` decides
  whether it drops. Creative breaks instantly and spends nothing.
- **Crafting**: `RECIPES` from `rec(rows, key, out, n)`; each key letter maps to a list of acceptable
  ids. `matchRecipe(grid, w)` trims the grid to its contents and tries the recipe and its mirror, so
  one table serves the 2×2 inventory grid and the 3×3 crafting table.
- **Textures**: most block tiles and every item icon come from `ART`, one base64 PNG strip of 16×16
  tiles, with `ART.names` giving each tile's name. Blocks and food/material items were generated with
  Higgsfield (Seedream 5.0 Flash, 4×4 sheets sliced and box-downscaled in Python); the items were then
  cleaned in Python (stray pixels removed, octree-quantised to 10 colours, edge pixels darkened into a
  rim). The 20 tools and the stick are drawn geometrically instead: one shape per kind (a handle along
  x + y = 15, a pickaxe arc, axe blade, shovel spade, sword blade and guard) recoloured from a 5-shade
  palette per tier, so every tier lines up pixel for pixel. Each tool head is mirror-symmetric about
  the handle line (a pickaxe, shovel and sword across it, the axe blade along it). The 12 armour
  icons are pixel maps in the same tier palettes, the golden apple is the apple with its red
  recoloured to the gold palette, and the bed's `bed_top`, `bed_side` and `bed_icon` are pixel
  maps too, all appended to the strip. It is drawn over the atlas when it decodes, and
  `onArt` callbacks refresh anything built from tiles before then (icons, the hand, the hotbar). The
  `painters` cover everything else (glass, water, plants, torch, the ten `crack_N` stages, balls,
  pumpkin, melon, TNT); `wool_black` and `wool_pink` are tinted copies of the art's white wool. The
  atlas holds items too; `itemGeo(id)` extrudes a flat item's tile one texel thick (edge walls per
  opaque texel) for the held item and drops, and the icons read item canvases from `tileCanvases`.
  `iconURL(id)` draws full cubes isometric and everything else flat; it is cached per id.
- **Terrain** is pure functions of position and `SEED`. `continent`, `temperature` and `moisture` are
  smooth climate fields; `oceanMask`, `desertMask` and `mountainMask` shape `terrainHeight()`, and
  `biomeAt()` picks one of `BIOMES` (ocean, plains, forest, desert, jungle, taiga, mountains), which
  sets the surface blocks, ground cover, tree kinds and density (`TREE_DENSITY`) and the grass tint.
  Surface material also follows altitude (bare stone above `STONE_LINE`, snow above `SNOW_LINE`).
  `caveAt()` carves tunnels and caverns in 3D. Ground cover (grass, flowers, cactus, dead bushes,
  rare pumpkins and melons) is placed per column in `generateChunk()`. `FEATURES` rows (`cell`,
  `reach`, `at`, `place`) hold ore veins and trees, and a structure would be another. Veins follow
  Minecraft's classic `OreFeature` (`ORES`: size, veins per chunk, height range) and replace stone
  only, through `put()`'s `only` argument. Lake and ocean beds are sand, never gravel. `FLAT` worlds are bedrock,
  dirt and grass only. `findSpawn()` walks out from the origin to the first dry land.
- **Chunks** are 16 columns × 16 × 256 `Uint8Array`s in `chunkData` (plus a per-column `biomes`
  array), generated on demand by `generateChunk()` and evicted a few rings beyond render distance.
  `getBlock()` reads through, generating as needed. Chunk loads and rebuilds share a per-frame time
  budget (`FRAME_BUDGET`); `setBlock()` queues the edited chunk first so an edit shows at once.
- **Light**: sky light is a heightmap (`columnTop()` = highest opaque block) with a falloff by depth
  below it (`skyFrom()`), not a flood fill. Block light is flooded per chunk build by
  `blockLights()` from every light source in the edits of the 3×3 chunks around it (sources only
  ever come from edits). Both travel as a `light` vertex attribute; the terrain `ShaderMaterial`
  multiplies sky light by `uDay` (time of day) and takes the brighter of that and warm block light,
  so day and night never remesh. Placing or removing a light source dirties the 3×3 chunk ring.
  Faces also get per-vertex ambient occlusion and a face shade in the vertex colour, and each vertex
  averages sky and block light over the open cells beside it (smooth lighting). The held item and
  drops are tinted by `tintByLight()`, which uses `lightLevelAt()` (walking distance to sources).
- **Audio** (`SFX`): block sounds are one soft swell of filtered noise per material (`MAT_SND`: filter,
  grain count and length, which `grains()` turns into a single sound's duration, a low knock for hard materials, loudness); voices are a sawtooth through
  formant band-passes (`voice()`), positioned sounds are panned by `out(x, z)`, and every play is
  pitched a little differently. There are no separate bursts: a train of short grains, an instant start or a wide high band-pass is
  what makes them crunch.
- **UVs**: `UV_EPS` is a fraction of `TILE_W`, not an absolute; an absolute inset crops whole texels
  off every tile once the atlas is wide.
- **Meshing**: `buildChunk()` emits into three buffers: solid (alpha-cutout), water (translucent,
  double-sided, top lowered to 0.875) and plants (cutout, double-sided crossed quads).
- **Sky**: `updateSky()` runs the clock (`worldTime` 0..1, 0 = sunrise, one day = `DAY_LEN` s), sets
  sky and fog colours (blue fog under water), and moves the square sun and moon, the stars and the
  cloud layer (a shader plane that follows the camera with a world-anchored texture offset).
- **Player**: swept AABB via `moveAxis()` (shared with mobs and drops through `physics()`), sneaking
  sets `edgeGuard`. Survival state (`hp`, `food`, `sat`, `exh`, `air`) follows Minecraft's rules in
  `updateVitals()`; everything that hurts goes through `hurtPlayer()` (no-op in creative), and
  `die()` scatters the inventory and armour as drops and shows the death card. Fall damage uses
  `fallPeak`. `hurtPlayer(dmg, kx, kz, cause, bypass, unarmoured)`: armour (`armor[4]`,
  `armourHit()`) reduces everything except `bypass` (starving, drowning, the void) and `unarmoured`
  (falls). Jumping costs 0.12 exhaustion (0.35 sprinting), about twice Minecraft's; Ctrl or a
  double-tapped W sprints, and while Ctrl is held `beforeunload` asks before leaving, since Ctrl+W
  cannot be caught. `P.bed` is the respawn point, set by using a bed; `sleep()` skips the night (a joiner
  sends `sleep` and the host, which owns the clock, calls `wakeUp()`). `unstick()` lifts the player
  out of anything solid at spawn and on load.
- **Mobs**: `MOBS` defines each type (stats, box model in sixteenths of a block, drops); skins are 8×8
  `SKINS` painters. The host (or a solo player) runs `spawnMobs()` (surface hostiles at night,
  animals by day, cave hostiles at any time, found by scanning a column for a dark floor) and
  `updateMob()`; joiners only `syncMobs()` from snapshots and `coastMob()` between them. `targets()` lists everyone a mob can
  chase (remote players by their last pose); `hitTarget()` hurts the local player or sends `hurt`.
  Every hostile mob burns in daylight under open sky (`m.burning`, snapshot flag 8, drawn as an
  orange flicker with flame particles on both sides).
  Creepers call `explode()`, which edits blocks through `editBlock()` and sends joiners a `boom` so
  each works out their own damage in `blast()`. Skeleton `arrows` are simulated by the host too.
- **Drops** are local to each player (never networked): `spawnDrop()`, picked up in `updateDrops()`.
- **Leaf decay**: `breakAt()` on a log calls `queueDecay()`, which queues every leaf within 6 blocks
  (`decay`, keyed by cell); `tickDecay()` removes each after a random 0.5–6.5 s unless `logNear()`
  finds a log within 6 steps through leaves. It runs on the breaker's side and edits go through
  `editBlock()`.
- **Furnaces** live in `furnaces` (key `"x,y,z"` → slots, burn, cook) and tick in `tickFurnaces()`,
  swapping the block to `furnace_lit` while fuel burns. They are per player in multiplayer.
- **Chests** live in `chests` (key `"x,y,z"` → 27 slots, `chestAt()`), open in the `#inv` panel as
  kind `'chest'` (`curChest` is a list of stores, the `#chestGrid` slots map index `i` to store
  `i / 27`), spill when broken, and are saved with the world. Per player in multiplayer, like
  furnaces. Placing a chest beside a single chest with the same facing turns the pair into
  `chest_l` / `chest_r` rows (half-latch fronts, `pairOf()` finds the partner) and opens as one
  54-slot chest; breaking a half turns the other back into `chest`.
- **Beds** are two blocks: `bed` rows (the foot, the item) and `bed_head` rows one block further
  from the placer, both `shape: 'bed'` with `half`. `placeBlock()` places the head (or refuses),
  `breakAt()` removes the other half; `addBed()` maps the one-legged `bed_side` so legs sit at the
  outer corners only.
- **Recipe book**: `BOOK` groups `RECIPES` by output; `renderBook()` lights what `canMake()` (a
  greedy count over each key letter's ids, inventory plus grid) and `fits()` the grid allows;
  `layOut()` returns the grid to the inventory and places one set.
- **Info screen** (`G`, the `showHud` option): `renderInfo()` fills `#statsText` four times a second;
  `pointTo()` turns the `#compass` arrows (spawn, bed) every frame. −Z is north.
- **Held item**: a separate `handScene` rendered after the world with the depth buffer cleared, so it
  never clips into walls (`renderer.autoClear` is off; the loop clears).
- **Camera modes** (`camMode`, cycled with R): first person, third person behind, third person in
  front. `placeCamera()` always sets `eye`, an unrendered camera at the first-person view, and
  `raycast()`, `pickMob()`, eating particles and item drops aim from `eye`, never `camera`, so the
  camera can back off (stopping short of opaque blocks) without moving the aim. The hand is only
  drawn in first person; in third person `self`, an avatar built by `makeAvatar()` like the
  remote ones, stands in for the player.
- **Pixel-perfect UI**: item icons show at 32px (2× a 16px tile), heart/hunger/air icons are 9×9
  `ICON_MAPS` shown at 18px (2×); a non-integer scale doubles some pixel rows and not others. Panels
  (`.gpanel`) centre with `inset` + `margin: auto`, not a −50% transform, and `#invName`/`#pkName`
  have a fixed height, so text changes never move the panel.
- **UI**: `#inv` is the survival inventory, crafting table, furnace and chest in one panel; every
  on-screen slot is `{ el, arr, i, kind }` from `mkSlot()`, and `clickSlot()` implements pick up /
  place / split / shift-click. A click outside the panel `toss()`es the cursor stack (right click:
  one). Closing it (`closeInv()`) returns the crafting grid and the carried stack to the inventory. Creative uses `#picker` instead. Hearts, hunger and air are painted 9×9 icons.
- **Edits, worlds & storage**: `edits` (chunk key → Map of cell index → id) is the world diff.
  `saveWorld()` stores it with the player, inventory, time, spawn and furnaces under
  `flatcraft.world.<id>`; the index `flatcraft.worlds.v1` holds `{id, name, seed, flat, mode, ...}`
  (worlds without `mode` are creative, which is how they were built). Worlds are read and written
  only through a world source (`load()`, `save()`, `flush()`); a joiner's source returns what the
  host sent and saves nothing.
- **Multiplayer** is host-authoritative over PeerJS; the section comment lists the messages. The host
  sends `{t:'w'}` with seed, mode, time and spawn after the edits; its 20 Hz `{t:'ps'}` carries poses,
  the clock, a mob list and arrows. A pose is `[x, y, z, yaw, pitch, armour]`, where armour
  is each slot's tier (0 none, 1 iron, 2 gold, 3 diamond) in base 4; `dress()` draws it on avatars
  as tier-coloured boxes. Joiner → host: `p` pose, `b` edit, `hit` mob, `c` chat, `sleep`. Host →
  joiner additionally: `hurt`, `loot` (drops for a joiner's kill), `boom`. **Every local block change
  goes through `editBlock()`**; only the receive paths call `setBlock()` directly.
  The link works like Scrapline's (two lanes, sequence numbers, `bye`, non-fatal errors). `stream()`
  sends `p`/`ps` on the fast lane, and `toHost()`/`broadcast()` send everything else reliably.
  Reconnecting:
  - **Joiner.** `linkLost()` releases pointer lock, and `requestLock()` refuses while `net.down`.
    The joiner then `redial()`s with `back: { id, tok }` in the connection metadata.
  - **Host.** On a drop (but not a `bye`), the host keeps the joiner's slot in `away` for
    `NET_GRACE`. When the joiner returns with the same id and token, the host gives it that id
    back and resends the edits.
  - **Resync.** The joiner keeps its inventory and runs `resyncEdits()`. That function takes every
    cell the host has, and puts any cell edited only locally back to its generated block (by
    generating the chunk without its edits).
- **Title screen**: `drawLogo()` builds the FLATCRAFT title from grass blocks (a five-row pixel font,
  each set pixel a block with its front, top and right faces) into `#logoCanvas`; a random `SPLASHES`
  line sits beside it; `updatePanorama()` turns a fixed-seed world behind the menu, a world with no
  source (nothing saves, no mobs) that entering a real world clears. `body.in-menu` styles all of it.
- **Combat feel**: a hit while falling is a critical hit (×1.5, `critStars()` and `SFX.crit`); a sword
  hit draws a `slash()` sweep. Held tools swing about the grip on Minecraft's curves (`swingHand()`).
- **Screens**: `screen` is `menu`, `pause`, `play` or `dead`. A solo world only simulates in `play`
  (it pauses under the pause card and death screen); a shared world keeps running.
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
