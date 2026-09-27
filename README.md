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
- after talking to an NPC: `↑`/`↓` or `1–5` to choose a question, `E` to ask, `Esc` to leave
- `Tab` — quest log
- `M` — mount / dismount (after getting the Mount Sheep™)

## Save

Single-player progress autosaves to your browser (Memories, quests, position, mount).
Reload and the title offers `[Enter] Continue`; press `[N]` for a new game. It's local only —
nothing is stored server-side, and co-op state is not saved.

## The mission

Main quest: **The Five Memories** (Old Bell, Red Flower, Wooden Toy, Old Ribbon, Photograph).
Find all 5 to open the Old Shrine, then find the truth waiting at the altar.

Three sidequests: flowers for Baaabara, a missing friend named Bo, and the Extremely
Important Rock.

Two secrets hide off the path. Finding them is optional — and encouraged.

### Co-op

Open `http://localhost:8080` in two tabs (or two machines on the network).
Press `C` on the title screen: with the field empty, `Enter` creates a new room code;
type a friend's code and `Enter` joins it. Or append `?room=<code>` to join directly.
If the relay is down, the game plays single-player — networking never blocks play.

**Reconnect:** if the connection drops mid-run, the HUD shows `Reconnecting…` (the title shows
it too), the partner is cleared instead of lingering, and the client keeps retrying the same
room with backoff until the relay returns — no reload needed. On recovery a `Reconnected ✓`
blip appears. A manual leave stops the retries.

### Mount

Talk to the Elder, then visit the Mount Keeper in the Farm to receive the Mount Sheep™.
`M` mounts/dismounts — mounting puts the black sheep on top of the white Mount Sheep for
faster movement, in the same top-down view. `E` still talks and picks things up while mounted.

### Local AI NPCs (optional)

The Elder can answer your guided questions with a browser-local model (Qwen2.5‑0.5B via
Transformers.js on WebGPU). It is entirely optional: if WebGPU is missing, the CDN is
blocked, or the model fails to load, the game silently uses the scripted answers and stays
fully playable. The game never waits on the model.

- Inspect state in the console: `__npcAI()` → `{status, selected, webgpu, importOk, modelReady, progress, lastError, ...}`.
- Force scripted (for testing/older browsers): open with `?noai=1`.
- If your network or browser blocks the Hugging Face **weight** CDN (`*.cdn.hf.co`):
  - point at a reachable host: `?hfhost=https://<host-with-the-model>`, or
  - self-host the weights same-origin: put the repo files under
    `models/onnx-community/Qwen2.5-0.5B-Instruct/` and open with `?localmodel=1`
    (the server already serves `/models/`).

Only the Elder uses the local model for now; all other NPCs stay scripted.

**Frozen (2026-09-27).** This AI layer is complete and won't be extended. It is optional
flavor only: with it off (or unreachable), the guided Q&A and every NPC line still work
via the scripted answers. If the weight CDN is blocked on your network, that's expected —
the game just stays scripted.

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
src/data/           world maps, NPCs, dialogue, quests, hotspots (all content)
src/systems/        collision, world, player, dialogue, quests, collectibles, mounts, net
src/ui/             HUD, dialogue box, ending screen
tools/validate.mjs  map integrity check
tools/smoke.mjs     headless full playthrough
tools/cdp_verify.mjs  two-browser co-op render check
```