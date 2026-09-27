# BLACKSHEE

BLACKSHEE is a comedy about sheep that slowly becomes a story about remembering someone who mattered.

A short, top-down exploration game about a Black Sheep in a valley that has forgotten Baa. Wander, talk to odd sheep, help with small quests, and gather five ordinary Memories: an **Old Bell**, a **Red Flower**, a **Wooden Toy**, an **Old Ribbon**, and a **Photograph**. Each object brings back a fragment of a life. Nobody erased Baa; the valley simply forgot.

## The game

Explore → talk → find a Memory → hear a fragment → open the next part of the valley. The Five Memories lead toward the Old Shrine and the question of who Baa was. The longer story leaves another question open: where is the other Black Sheep?

NPC dialogue has a **guided AI layer**: the language model can vary a line's phrasing, with written fallbacks, but the game state controls the facts and quest progress. AI does not invent lore, Memories, family relationships, quests, or mechanics.

Ride a White Sheep to move faster and switch to a first-person mounted view. That view is a lightweight raycaster over the same 2D world, not a separate 3D game.

The story's shipping direction is **single-player**. An experimental room-code WebSocket co-op relay is in the codebase, but multiplayer polish and its place in the story are deferred. The second Black Sheep is a mystery, not a promised co-op unlock in this build.

## Run locally

Requires **Node.js 18+**.

```bash
npm install
npm start
```

Open http://localhost:8080 (set `PORT` to use another port). The frontend is vanilla JavaScript and Canvas 2D; one Node process (`server.js`) serves the static files and the WebSocket relay. Its only runtime package dependency is `ws` 8.x. No frontend framework or build step is needed.

**Controls:** `WASD`/arrows to move · `E`, `Enter`, or `Space` to talk or interact · `Tab` for the quest log · `M` to mount or dismount after unlocking the mount.

## What existed vs. what we built today

BLACKSHEE began at the **TSIP hackathon on September 26, 2026**. Its exploration core, quests, five-Memories structure, mounts, first-person raycaster, and room-code multiplayer prototype predate this event.

For **AGENTHON on September 27**, the work focused on a guided AI NPC dialogue layer with written fallback lines, a sharper narrative direction recorded in the *Story & Design Handout v2*, and mounted-view polish. This is an iteration on an existing game, not a from-scratch build. Multiplayer remains an experimental prototype rather than the focus of this submission.