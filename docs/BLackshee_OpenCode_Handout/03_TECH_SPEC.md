# BLACKSHEE --- TECHNICAL HANDOUT FOR OPENCODE

## Objective

Build a small browser game using the simplest reliable architecture.

Preferred stack: - HTML - CSS - vanilla JavaScript - Canvas 2D or simple
DOM rendering

Use no framework unless there is a strong reason.

No backend.

No database.

No authentication.

No external API dependency.

The game must run locally by opening/serving the project and must be
easy to submit as a web game.

## Architecture

Keep systems separated:

``` text
src/
  main.js
  game.js

  systems/
    player.js
    collision.js
    dialogue.js
    quests.js
    collectibles.js
    interactions.js
    world.js

  data/
    npcs.js
    quests.js
    collectibles.js
    dialogue.js

  ui/
    hud.js
    dialogue_box.js
    quest_log.js
```

If this structure is too much for the time available, use fewer files,
but preserve separation between: - game state - content/data -
rendering - interaction logic

## Game state

Use one central state object.

Conceptually:

``` js
const state = {
  player: {
    x: 0,
    y: 0
  },

  quest: {
    memories: 0,
    memoriesRequired: 5,
    completed: [],
    active: []
  },

  inventory: [],
  collected: [],
  flags: {},

  endingUnlocked: false
};
```

Do not duplicate quest or collectible state across multiple systems.

## NPC data

NPCs should be data-driven.

Example:

``` js
{
  id: "elder",
  name: "Elder Sheep",
  x: 100,
  y: 120,
  dialogue: [
    "Welcome, little sheep.",
    "We need your help."
  ]
}
```

## Quest data

Example:

``` js
{
  id: "flowers",
  title: "The Three Flowers",
  type: "collect",
  target: 3,
  progress: 0,
  reward: "memory_02"
}
```

Only implement the minimum quest types required by the actual content.

Recommended: - collect - talk - fetch - explore

Do not build a generalized quest scripting language.

## Interaction

Use one interaction key:

`E`

Flow: - move near object/NPC - press E - determine interaction target -
trigger dialogue/quest/collection - update state - refresh HUD

## Movement

Use: - WASD - arrow keys as optional fallback

Keep movement responsive.

Collision can use simple rectangles or tile collision.

Do not build a physics engine.

## World

Use a small handcrafted map.

Prefer a tile-like or grid-like layout because collision and placement
are easier.

The map only needs enough detail to support exploration.

## HUD

Always show:

``` text
MEMORIES: 2 / 5

MAIN QUEST:
Find the remaining Memories.
```

A quest log can be opened with `Tab` or a visible button.

Keep the HUD readable and compact.

## Dialogue

Dialogue should: - pause or strongly reduce gameplay interaction - show
speaker name - show text - advance with E / Enter / click - support
multiple lines - close cleanly

Avoid typing animations unless they are trivial.

## Collectibles

When collected: - immediately update counter - give clear visual/audio
feedback if available - prevent duplicate collection - optionally show a
short message

## Locked final area

Before 5/5: "Something is keeping the shrine sealed."

At 5/5: "The seal is gone."

Do not create a complex lock/key system.

## Ending

When the final condition is satisfied: - stop normal quest progression -
show final sequence - display ending state - provide a restart button or
key

## Visual style

Retro-inspired, not a direct copy of Nintendo assets.

Use: - simple pixel-art-like shapes - limited palette - chunky
characters - readable silhouettes - simple animations

Do not spend large amounts of time drawing detailed assets.

Simple procedural shapes are acceptable for the prototype.

## Audio

Audio is optional.

If time permits, add a few tiny sound effects: - interaction -
collectible - quest completion - final reveal

Do not spend the critical implementation window integrating a
complicated audio library.

## Testing hooks

Keep it easy to test progression.

During development, a temporary debug shortcut may: - add a Memory -
complete a quest - teleport to areas

Do not expose debug controls in the final build.

## Definition of done

The build is DONE when a new player can:

1.  start the game;
2.  understand the main mission;
3.  move around;
4.  talk to sheep;
5.  complete at least 3 sidequests;
6.  collect all 5 Memories;
7.  unlock the final area;
8.  complete the final encounter;
9.  see the ending;
10. restart the game.

Everything beyond this is optional polish.
