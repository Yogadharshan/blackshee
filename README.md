# BLACKSHEE

A tiny retro sheep RPG. You are the only black sheep in a world of white ones.
Collect the five Memories, help a few weird sheep, and break the seal on the Old Shrine.

Built during the TSIP hackathon. Vanilla JavaScript, Canvas 2D, no frameworks, no backend.
One Node process serves the static game *and* the WebSocket co-op relay — deploy-ready.

## Run locally

```bash
npm install
npm start          # serves http://localhost:8080 (static + ws relay on same port)
# open http://localhost:8080
```

Port comes from `$PORT` (set by Railway/Render/Fly) or defaults to 8080.

## Controls

- `WASD` / arrows — move
- `E` / Enter / Space — talk, pick up, advance dialogue
- `Tab` — quest log
- `M` — mount / dismount (after getting the Mount Sheep™)

## The mission

Main quest: **The Five Memories** (Old Bell, Red Flower, Wooden Toy, Old Ribbon, Photograph).
Find all 5 to open the Old Shrine, then find the truth waiting at the altar.

Three sidequests: flowers for Baaabara, a missing friend named Bo, and the Extremely
Important Rock.

Two secrets hide off the path. Finding them is optional — and encouraged.

### Co-op

Open `http://localhost:8080?room=1` in two tabs (or two machines on the network).
Press `C` on the title screen for a room code, or append `?room=<code>` to join directly.
If the relay is down, the game plays single-player — networking never blocks play.

### Mount + first-person

Talk to the Elder, then visit the Mount Keeper in the Farm to receive the Mount Sheep™.
`M` mounts/dismounts — mounting gives faster movement and a first-person raycasted view
of the same world. `E` still talks and picks things up while mounted.

## Deploy

The game deploys anywhere that runs a long-lived Node process. It is one process, one
port: static files + `/healthz` + `/ws` WebSocket relay.

### Railway / Render (git push)

1. Push this folder as its own GitHub repo (it can't be part of the big `forge` repo):

   ```bash
   git init && git add -A && git commit -m "blackshee: deployable single-process build"
   # create a repo on GitHub, then:
   git remote add origin git@github.com:<you>/blackshee.git
   git push -u origin main
   ```

2. **Railway**: New Project → Deploy from GitHub repo → Railway reads `npm start`
   from package.json and sets `PORT` for you. Add a public domain.

   **Render**: New → Web Service → pick the repo. Build: `npm install`, Start: `npm start`.
   Health check path: `/healthz` (default 200 "ok"). Get a free `.onrender.com` URL.

That's it — no proxy, no extra config. The client dials `wss://<same-host>/ws?room=...`
automatically (same-origin, no hardcoded port).

## Verify it actually works

```bash
npm run check      # map integrity + headless full playthrough (state-level)
node tools/cdp_verify.mjs   # two REAL Chromium instances in one room, asserts co-op render
BASE=https://<your-deployed-url> node tools/cdp_verify.mjs   # same check against the live deploy
```

`cdp_verify` needs `chromium-browser` installed. Both commands exit non-zero on failure.

## Project layout

```
server.js           single process: static + /healthz + ws relay
index.html          entry, canvas
src/main.js         game loop bootstrap
src/game.js         orchestration: state, update, render, input, mount, net
src/render/         first-person raycaster (pseudo-3D mounted view)
src/data/           world maps, NPCs, dialogue, quests, hotspots (all content)
src/systems/        collision, world, player, dialogue, quests, collectibles, mounts, net
src/ui/             HUD, dialogue box, ending screen
tools/validate.mjs  map integrity check
tools/smoke.mjs     headless full playthrough
tools/cdp_verify.mjs  two-browser co-op render check
```