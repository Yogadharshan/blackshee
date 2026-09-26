# BLACKSHEE --- OPENCODE EXECUTION PLAN

## Role

You are the implementation agent for a 2-hour game jam.

Optimize for a finished playable game, not architectural elegance.

Do not invent large systems.

Do not add features that are not in the handout.

When uncertain, choose the smallest implementation that preserves the
intended player experience.

## Implementation order

Work in these phases.

### PHASE 1 --- PLAYABLE FOUNDATION

Implement: - web project - game entry point - player - movement -
camera/rendering - map - collision - interaction key - basic NPCs

STOP and verify the player can walk around and interact.

### PHASE 2 --- QUEST FOUNDATION

Implement: - central game state - quest data - quest tracking -
dialogue - quest log - main objective HUD

Add the main mission:

"Collect 5 Memories."

STOP and verify quest state updates correctly.

### PHASE 3 --- COLLECTIBLES

Implement 5 Memories.

Requirements: - visible in world - interactable - collected once -
counter updates - collection persists during the session - collecting 5
unlocks the final area

STOP and test the entire main progression.

### PHASE 4 --- SIDEQUESTS

Add exactly 3 small sidequests.

Keep them simple.

Do not create new gameplay systems for individual sidequests.

Use the existing collect/talk/fetch/explore systems.

STOP and verify all quests can be completed.

### PHASE 5 --- FINAL ENCOUNTER

Implement: - final area - final NPC/object - short reveal - ending -
restart

The final encounter must not depend on combat.

STOP and play from a fresh start to the ending.

### PHASE 6 --- PERSONALITY

Only after the game is functionally complete, add:

-   funny NPC lines
-   repeated interaction jokes
-   black sheep jokes
-   3 secrets
-   one fourth-wall moment
-   small environmental jokes
-   emotional dialogue

Do not change core systems unless required for a bug fix.

### PHASE 7 --- POLISH

Only if time remains: - improve readability - add small animations -
improve spacing - add simple sound effects - improve dialogue timing -
improve ending presentation

## Agent behavior rules

### Do

-   inspect the existing project before changing it;
-   keep changes small;
-   run/test after major phases;
-   fix runtime errors immediately;
-   prefer deterministic behavior;
-   keep content data separate from engine logic;
-   preserve working functionality;
-   use placeholder art if needed.

### Do not

-   rewrite working systems without a reason;
-   install large frameworks;
-   create backend infrastructure;
-   add multiplayer;
-   add combat;
-   add procedural generation;
-   add save accounts;
-   add unnecessary abstractions;
-   spend time making a perfect architecture;
-   add features because they sound cool.

## If time becomes tight

Use this priority:

``` text
1. movement
2. map
3. NPC interaction
4. dialogue
5. main quest
6. 5 Memories
7. final area
8. ending
9. 3 sidequests
10. secrets
11. polish
```

If necessary, reduce sidequest complexity before cutting the ending.

## Content implementation

Keep all dialogue and content easy to edit.

Prefer data such as:

``` js
const dialogue = {
  elder_intro: [
    "The shrine has been silent for years.",
    "Find the five Memories.",
    "Then come back."
  ]
};
```

This allows the developer to rapidly edit jokes and narrative during the
final minutes.

## Final verification checklist

Before submission:

-   [ ] Game launches without console errors.
-   [ ] Player can move.
-   [ ] Collision works.
-   [ ] NPC interaction works.
-   [ ] Dialogue advances and closes.
-   [ ] Main quest appears.
-   [ ] 5 Memories can be collected.
-   [ ] Counter reaches 5/5.
-   [ ] Final area unlocks.
-   [ ] Final encounter works.
-   [ ] Ending works.
-   [ ] At least 3 sidequests work.
-   [ ] At least one secret works.
-   [ ] Restart works.
-   [ ] No debug UI is visible.
-   [ ] No required external service can fail the game.

## Final principle

A complete simple game beats an ambitious broken game.

Stop adding systems once the player can complete the intended
experience.
