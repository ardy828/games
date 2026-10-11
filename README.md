# Games

Browser games, each one a **single self-contained HTML file** — no build step, no dependencies,
no bundler. Open the file in a browser and it runs. The one exception is Scrapline's co-op mode,
which pulls PeerJS from a CDN when you press CO-OP.

**▶ Play them: <https://ardy828.github.io/games/>**

| Game | Type | Play | Folder |
|---|---|---|---|
| **Block Blast** | 8×8 block puzzle | [Play](https://ardy828.github.io/games/blockblast/) | [`blockblast/`](blockblast/) |
| **Scrapline** | Top-down arena shooter | [Play](https://ardy828.github.io/games/scrapline/) | [`scrapline/`](scrapline/) |
| **Flappy Finch** | One-button arcade | [Play](https://ardy828.github.io/games/flappy/) | [`flappy/`](flappy/) |
| **Flatcraft** | 3D survival sandbox with biomes, mobs and crafting | [Play](https://ardy828.github.io/games/flatcraft/) | [`flatcraft/`](flatcraft/) |
| **Obito's Multiverse** | Story-driven ninja action adventure | [Play](https://ardy828.github.io/games/obito/) | [`obito/`](obito/) |

Each game's menu has a button back to the landing page.

## Block Blast

Drag pieces from the tray onto an 8×8 grid. Fill a whole row or column and it blasts away.
The game ends when none of the three pieces in the tray fit anywhere.

- **Controls** — drag a piece onto the grid with the mouse or a finger. The piece stays
  under your pointer, and a shadow on the board shows where it will land. On touch the piece rides a cell above your thumb so you can
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
- **Online co-op for two.** CO-OP on the menu: one player hosts and gets a six-digit room code, the
  other types it in to join. Same arena, same waves, each player picks their own upgrades and the next
  wave waits for both. Anyone who goes down sits out until the next wave; the run ends when both are
  down. The browsers talk directly over WebRTC (PeerJS, loaded from a CDN only when you press CO-OP),
  so both need to be online; nothing else is hosted.
- All audio is synthesised at runtime with the Web Audio API — no audio files.

## Flappy Finch

A goldfinch flies itself over a dusk skyline until you tap. One button does everything.

- **Controls** — click/tap anywhere, or Space/↑, to flap; the same input starts a run from the
  title screen and restarts one from "get ready". `P`/Esc pauses, `M` mutes; both also have buttons.
- Flying speed and the gap between pipes both tighten gradually as your score climbs.
- Four medals — Bronze, Silver, Gold, Platinum — awarded on the game-over screen at 10/20/30/40
  pipes; falling short shows how many more pipes reach the next one.
- The bird sprite, medals, skyline silhouettes and ground texture are all baked at boot from small
  pixel-rect descriptions onto offscreen canvases, then drawn scaled with smoothing off — no image
  files. All audio is synthesised at runtime with the Web Audio API. The high score is kept in
  `localStorage`.

## Flatcraft

A Minecraft-style survival sandbox. An endless world of biomes (plains, forest, desert, jungle,
snowy taiga, ocean and mountain ranges) with caves, ore, a day and night cycle, hostile and
friendly mobs, crafting, tools and furnaces. Terrain is generated from value noise, so a seed
always makes the same world.

- **Modes** — each world is Survival or Creative, chosen when you make it. Survival has health,
  hunger and air; blocks take time to mine depending on the tool, drop as items you pick up, and
  some need the right pickaxe tier (stone for iron, iron for gold and diamond, diamond for
  obsidian). Creative breaks instantly, lets you fly and has a picker with every block and item.
- **Controls** — WASD to move (Ctrl or double-tap W to sprint), mouse to look, Space to jump or swim
  (double-tap to fly in creative), Shift to sneak (you will not walk off edges). Hold left click to
  mine or hit a mob; right click places, opens a crafting table or furnace, sleeps in a bed, puts
  on held armour, and held with food eats it. `1`–`9` or the wheel pick a slot, `E` opens the inventory (the picker in creative), `Q` drops
  the held item, middle click picks the block you look at in creative, `R` cycles first person,
  third person from behind and third person from the front, `G` shows the info screen (coordinates,
  facing, biome, time, light, the block you look at, and compass arrows to spawn and your bed).
  With the inventory open, clicking outside it throws the held stack out (right click throws one).
  Esc pauses.
- **Crafting** — a 2×2 grid in the inventory, 3×3 at a crafting table: planks, sticks, crafting
  table, furnace, torches, wood/stone/iron/gold/diamond pickaxes, axes, shovels and swords,
  iron/gold/diamond armour, chests (8 planks in a ring, 27 slots; two side by side facing the same way make a 54-slot
  large chest), beds (3 wool over 3 planks), golden apples (4 gold ingots round an
  apple, which restore full health and hunger and can be eaten on a full stomach), storage blocks and more. Shift-click moves stacks, right click splits them. The RECIPES button opens a recipe book: what
  you can make comes first, hovering lists the ingredients, and clicking one lays it out in the grid. Furnaces smelt ore, sand,
  cobblestone, clay, logs and raw meat with coal, charcoal or wood.
- **Day and night** — a day is ten minutes, with a square sun and moon, stars and blocky clouds.
  Light comes from the sky and from torches. Zombies, skeletons and creepers come out in the dark
  (and burn in daylight), and in dark caves at any time; pigs, cows and sheep graze in daylight and drop food. Beds are two blocks long. Sleeping in a bed
  at night skips to morning, and the last bed you used is where you respawn.
- **Armour** — helmet, chestplate, leggings and boots go in the column beside the crafting grid
  (or right click to put one on). Each point shown above the hearts takes 4% off a hit, up to 80%
  for full diamond; pieces wear with every hit and break. Falls, drowning and hunger ignore it.
- **Worlds** — up to five, each with its own name, seed and mode; tick Flat for a superflat world.
  Blocks, your position, health, inventory, armour, bed, furnaces, chests and the time of day are saved in
  `localStorage` per world.
- **Options** — render distance, mouse sensitivity, field of view, volume, view bobbing and the
  info screen (also `G`).
- **Multiplayer** — peer to peer, up to 8 players. The host opens a world, presses Esc and chooses
  Open to Friends for a six-digit code; friends type it into the Multiplayer tab. The host runs the
  mobs and the clock; each player keeps their own inventory. `T` chats. Uses PeerJS over WebRTC,
  fetched from cdnjs only when you host or join.
- **Art** — block and item textures are 16×16 pixel art generated with Higgsfield (Seedream) and
  embedded in the page as one PNG strip; the tools and stick are drawn geometrically so every tier
  lines up, and glass, water, plants, torches, cracks, mobs and a few blocks are painted in code.
  Held and dropped items are extruded into 3D. Sounds are synthesised. Rendering uses Three.js from
  cdnjs.
- **Title screen** — the logo is built from grass blocks, a splash line pops beside it and a world
  turns slowly behind the menu. Hits while falling are critical hits (half as much again, with a burst
  of stars), and sword hits sweep.
- Desktop only for now: it needs a mouse and keyboard (pointer lock).

## Obito's Multiverse

A story-driven ninja action game. Obito is stealing power from other worlds to become the perfect
villain; you are a normal ninja from the Leaf who has to stop him, chapter by chapter, through
fights against bosses pulled from other worlds (Jujutsu Kaisen's Sukuna, and a One Piece arc with
Luffy's crew, a Marine ambush and Kabuto) and a final showdown with Obito himself.

- **Controls** — WASD or the arrow keys to move, `J` to strike, `K` and `L` for your two jutsu,
  Space to dash and to advance dialogue, Shift, `R` and `I` for powers unlocked along the way,
  `M` toggles sound and Esc skips a cutscene.
- **Touch** — on a phone or tablet a floating stick on the left moves you and buttons on the right
  strike, cast both jutsu, dash and use unlocked powers (they light up as cooldowns finish). Tap the
  screen to go through dialogue; Skip, sound, full screen and home sit in the top corner. Best played
  sideways.
- **Easy mode** — pick Easy in the character creator: enemies hit for 40% less, and you get 50% more
  health and chakra, which also refills faster. It is saved with your progress.
- **Your ninja** — pick a name, hairstyle, hair, skin, outfit and headband colours, and two of five
  elements (Fire, Water, Lightning, Wind, Earth), each with its own jutsu.
- Progress is saved per chapter in `localStorage`, so Continue picks up where you left off; losing
  a fight lets you retry it.
- Everything is drawn on a canvas in code and all audio is synthesised with the Web Audio API.

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
