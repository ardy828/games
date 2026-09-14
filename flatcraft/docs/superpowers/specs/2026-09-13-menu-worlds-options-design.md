# Flatcraft: menu screen, worlds, options (design)

Approved 2026-09-13.

## Menu screen
Replaces the start card. Title plus three tabs: Worlds, Options, Multiplayer.

- **Worlds**: list of saved worlds (max 5) with name, seed, last played; Play / Rename / Delete per row.
  "New World" form: name + optional seed (random when blank). Disabled with a note when 5 worlds exist.
- **Options** (global, saved in browser, applied live): render distance 3-10 chunks, mouse sensitivity,
  field of view, show stats HUD toggle.
- **Multiplayer**: "Coming soon" panel; server address field and disabled Join button.

## Pause
Esc (pointer unlock) in a world shows a pause card: Resume, Options, Save & Quit to Menu.
Quit returns to the menu without a reload.

## Storage (localStorage)
- `flatcraft.worlds.v1`: index `[{id, name, seed, created, played}]`
- `flatcraft.world.<id>`: `{seed, edits: [[chunkKey, [idx, id, ...]], ...], player: {x,y,z,yaw,pitch,flying}}`
- `flatcraft.options.v1`: options object
- Legacy `flatcraft.edits.v2` migrated into a world named "World 1" on first load, then removed.

## Multiplayer readiness
A `WorldSource` interface (`load()`, `save(state)`, `flush()`) sits between the game and storage.
`LocalWorldSource` is the only implementation; a remote source can slot in later.

## Code changes
Single file `index.html`. Seed and render distance become mutable; chunk/edit/player state gets a
reset so worlds can be switched in place; save/load keyed by world id.
