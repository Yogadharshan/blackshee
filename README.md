# BLACKSHEE

A tiny retro sheep RPG. You are the only black sheep in a world of white ones.
Collect the five Memories, help a few weird sheep, and break the seal on the Old Shrine.

Built during the TSIP hackathon. Vanilla JavaScript, Canvas 2D, no frameworks, no backend.

## Run

Any static server works (must be HTTP, not file://, so ES modules load):

```bash
npm run serve     # or: python3 -m http.server 8000
# open http://localhost:8000
```

## Controls

- `WASD` / arrows — move
- `E` / Enter / Space — talk, pick up, advance dialogue
- `Tab` — quest log

## The mission

Main quest: **The Five Memories** (Old Bell, Red Flower, Wooden Toy, Old Ribbon, Photograph).
Find all 5 to open the Old Shrine, then find the truth waiting at the altar.

Three sidequests: flowers for Baaabara, a missing friend named Bo, and the Extremely
Important Rock.

Two secrets hide off the path. Finding them is optional — and encouraged.

Co-op (modifier): run `node server.js` (the WebSocket relay), then open
`http://localhost:8000/?room=1` in **two tabs**. Both sheep appear in each
other's worlds; a second browser/tab on any machine on the network can join the
same room. If the relay is down, the game plays single-player — networking
never blocks play.

Mount: talk to the Elder, then visit the Mount Keeper in the Farm to receive
the Mount Sheep™. Press `M` to mount/dismount — mounting gives faster movement
and a first-person raycasted view of the same world (ground, walls, billboard
sheep, sparkling Memories). `E` still talks and picks things up while mounted.

## Project layout

```
index.html          entry, canvas
server.js           WebSocket relay (rooms, player-state broadcast)
src/main.js         game loop bootstrap
src/game.js         orchestration: state, update, render, input, mount, net
src/render/         first-person raycaster (pseudo-3D mounted view)
src/data/           world maps, NPCs, dialogue, quests, hotspots (all content)
src/systems/        collision, world, player, dialogue, quests, collectibles, mounts, net
src/ui/             HUD, dialogue box, ending screen
tools/validate.mjs  map integrity check (node tools/validate.mjs)
tools/smoke.mjs     headless full playthrough (node tools/smoke.mjs)
```