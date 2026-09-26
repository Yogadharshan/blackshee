# BLACKSHEE --- MOUNT + FIRST-PERSON MODIFIER HANDOUT

## Context

The game is already a working 2D online co-op retro RPG.

Do NOT rebuild the game.

The hackathon has introduced two modifiers:

1.  Create mounts that can be obtained by each character.
2.  When a player mounts their mount, their view changes to first
    person.

The goal is to satisfy both modifiers in a way that feels intentional,
funny, retro, and technically realistic within the existing 2D game.

------------------------------------------------------------------------

# 1. CORE DESIGN DECISION

Do NOT convert the game into a real 3D game.

Do NOT replace the existing 2D renderer.

Instead:

> The existing 2D world remains the source of truth, while mounting
> switches the presentation to a pseudo-3D first-person renderer.

The game therefore has two visual modes:

``` text
UNMOUNTED
Top-down 2D retro RPG
        ↓
    mount obtained
        ↓
MOUNTED
Pseudo-3D first-person retro view
```

This should feel like an intentional transformation, not a separate
game.

The mounted view can take inspiration from early raycasted first-person
games such as Wolfenstein/Doom-era rendering, but all game art and
assets must remain original.

------------------------------------------------------------------------

# 2. PLAYER EXPERIENCE

Normal mode:

-   top-down
-   Pokémon/classic RPG-like exploration
-   movement and interaction remain unchanged

Mounted mode:

-   player moves faster
-   camera becomes first person
-   world is rendered using the existing 2D map data
-   nearby objects can appear as billboard sprites
-   the player's mount can appear around the bottom of the view
-   hidden objects can optionally become easier to notice

The player should immediately understand:

> "I mounted something, and now I am seeing the world differently."

------------------------------------------------------------------------

# 3. MOUNTS

Each playable character must be able to obtain a mount.

Because this is Blackshee, keep the mount concept intentionally absurd.

Suggested mount:

## The Mount Sheep™

It is another sheep.

The joke is that a sheep is riding another sheep.

NPC dialogue can acknowledge this.

Example:

> "Every great adventurer needs a mount."

> "We have sheep."

> "You're a sheep."

> "Please don't overthink this."

Do not spend time building a complex mount customization system.

Each player only needs: - mount acquired flag - mount identity -
mounted/unmounted state - mounted movement speed - mounted rendering

If the current multiplayer architecture supports per-player character
identity, each character can have a slightly different mount
sprite/name.

------------------------------------------------------------------------

# 4. MOUNT ACQUISITION

Add a simple mount quest or interaction.

Example:

1.  Player reaches the Mount Keeper.
2.  Player completes a tiny requirement.
3.  Mount is granted.
4.  HUD/UI confirms mount acquired.
5.  Player can mount/unmount.

The acquisition flow must be short.

Do not add: - mount levels - mount stats - mount inventory - mount
breeding - mount upgrades - mount shops

Those are outside scope.

------------------------------------------------------------------------

# 5. MOUNT CONTROLS

Recommended:

-   `M` = mount / dismount

If the existing game already has a sensible mount interaction key, reuse
it.

Mounted state:

``` js
player.mounted === true
```

Unmounted state:

``` js
player.mounted === false
```

Mounting should: - set mounted state - increase movement speed - switch
renderer

Dismounting should: - clear mounted state - restore normal movement
speed - switch back to top-down renderer

Do not duplicate player movement logic unnecessarily.

------------------------------------------------------------------------

# 6. FIRST-PERSON IMPLEMENTATION

## Preferred solution: 2D raycasting

Use the existing 2D map/grid as the collision/world representation.

Conceptually:

``` text
Existing 2D map
      ↓
player position + direction
      ↓
cast rays across camera field of view
      ↓
find nearest blocking tile
      ↓
calculate projected wall height
      ↓
draw vertical strips
      ↓
pseudo-3D first-person view
```

The renderer does not need full 3D geometry.

A small number of rays is acceptable.

Prioritize: - stable frame rate - correct walls - readable movement -
retro appearance

Do not build a full general-purpose 3D engine.

------------------------------------------------------------------------

# 7. WORLD REPRESENTATION

The existing world should remain authoritative.

Do not create a second independent world map.

If possible, reuse:

-   tile grid
-   collision rectangles
-   obstacle data
-   object positions
-   NPC positions
-   collectible positions

The first-person renderer should interpret the existing world.

This prevents the two modes from becoming inconsistent.

------------------------------------------------------------------------

# 8. WHAT SHOULD BE RAYCASTED

Only raycast major blocking geometry.

Examples:

-   trees
-   walls
-   houses/buildings
-   fences
-   rocks
-   major terrain barriers

Do NOT attempt to turn every object into 3D geometry.

------------------------------------------------------------------------

# 9. BILLBOARD OBJECTS

NPCs, sheep, flowers, collectibles and other small objects can remain 2D
sprites.

In first-person mode they should behave like camera-facing billboard
sprites.

Conceptually:

``` text
              CAMERA
                ↓

             [ SHEEP ]
                 ↑
          camera-facing sprite
```

This is much cheaper than creating actual 3D models.

Prioritize billboard rendering only for objects close enough to be
visible.

If billboard rendering becomes too expensive during the hackathon, it is
acceptable to show only important objects.

------------------------------------------------------------------------

# 10. MOUNT FOREGROUND

To make first-person mode feel convincing, add a small mount silhouette
at the bottom of the screen.

For example:

``` text
┌──────────────────────────┐
│                          │
│        FOREST             │
│                          │
│      sheep NPC            │
│                          │
│  tree              tree  │
│                          │
│      \__________/         │
│       MOUNT HEAD          │
└──────────────────────────┘
```

This is a presentation layer only.

It should not interfere with world collision.

The mount foreground can be a simple pixel-art sprite.

------------------------------------------------------------------------

# 11. RETRO VISUAL STYLE

The first-person mode should deliberately look old-school.

Use: - low-resolution internal render target if practical -
nearest-neighbor scaling - hard pixel edges - limited palette - simple
textures - no modern 3D lighting - no smooth gradients - no realistic
materials

The contrast should be intentional:

``` text
Top-down:
cute retro RPG

Mounted:
weird retro pseudo-3D game
```

This visual switch is part of the joke and the hackathon identity.

------------------------------------------------------------------------

# 12. OPTIONAL GAMEPLAY VALUE

If time permits, mounted mode can reveal things that are harder to
notice in top-down mode.

Example:

A Memory is hidden behind an object.

Top-down: - difficult to notice

Mounted first-person: - a glowing/pulsing sprite is visible down a
corridor

This gives mounting a gameplay purpose beyond speed.

However:

## This is OPTIONAL.

Do not delay the core modifier implementation for this feature.

------------------------------------------------------------------------

# 13. MULTIPLAYER REQUIREMENTS

This is an online two-player game.

Both players must be able to:

-   obtain a mount independently
-   mount/unmount independently
-   move while mounted
-   see the other player's mounted/unmounted state
-   see the other player's position

Important:

The mounted visual mode is primarily local presentation.

The server/shared state only needs the information necessary for the
other client to represent the player's state.

Conceptually:

``` js
playerState = {
    id,
    x,
    y,
    direction,
    mounted,
    mountId
}
```

Do not synchronize camera orientation or rendered first-person frames.

Each client renders its own camera.

------------------------------------------------------------------------

# 14. OTHER PLAYER IN FIRST-PERSON MODE

When Player A is mounted:

-   Player A sees the world through the first-person renderer.
-   Player B continues seeing the normal top-down world if unmounted.
-   Player B sees Player A's mount/player representation.

Do not force both players into first-person mode.

The camera state is local to each player.

This is important for online co-op.

------------------------------------------------------------------------

# 15. ARCHITECTURE

Add a clean presentation seam.

Conceptually:

``` js
if (player.mounted) {
    renderFirstPersonWorld();
} else {
    renderTopDownWorld();
}
```

Keep the following systems shared:

-   world state
-   collision
-   player state
-   NPC state
-   quest state
-   collectible state
-   multiplayer synchronization

Only rendering/camera presentation should change.

Suggested structure:

``` text
systems/
    mount.js
    movement.js
    multiplayer.js

render/
    top_down_renderer.js
    first_person_renderer.js
    billboard_renderer.js
```

Adapt this to the existing project structure rather than forcing a
rewrite.

------------------------------------------------------------------------

# 16. IMPORTANT IMPLEMENTATION RULE

Build the modifier incrementally.

## Step 1 --- Mount state

Make one player able to mount/unmount.

Verify: - state changes - movement speed changes - multiplayer state
sync works

## Step 2 --- Minimal first-person prototype

Before adding polish, make the existing map render as simple
first-person walls.

At this stage:

-   ugly graphics are acceptable
-   flat colors are acceptable
-   no NPC billboards are required

The only goal is:

> Mount → screen becomes first person → move around → walls behave
> correctly.

## Step 3 --- Billboard objects

Add: - sheep - NPCs - collectibles

Only after the raycaster works.

## Step 4 --- Mount presentation

Add: - mount foreground - mount sprite/state - simple animation if cheap

## Step 5 --- Retro polish

Add: - pixel scaling - textures - visual effects - transition - sound if
available

## Step 6 --- Multiplayer verification

Test:

``` text
Player A unmounted
Player B unmounted

Player A mounts
Player B sees A mounted

Player B mounts
Player A sees B mounted

Player A dismounts
Player B sees A dismounted
```

------------------------------------------------------------------------

# 17. TRANSITION

A tiny transition will make the mode switch feel intentional.

When mounting:

``` text
MOUNT
↓
quick pixel zoom / wipe
↓
FIRST PERSON
```

When dismounting:

``` text
DISMOUNT
↓
quick pixel transition
↓
TOP DOWN
```

Keep the transition under approximately 300 ms.

If transitions introduce bugs, remove them.

The mode switch itself is more important.

------------------------------------------------------------------------

# 18. FAILURE MODES

Do NOT:

-   convert the whole project to 3D
-   introduce Three.js/Babylon unless absolutely necessary
-   create 3D models
-   rebuild the map
-   duplicate world state
-   implement physics
-   implement realistic mounts
-   create a second game engine
-   rewrite multiplayer
-   rewrite quest systems
-   create a general 3D framework

The existing 2D game is the foundation.

The modifier should be an additional rendering mode.

------------------------------------------------------------------------

# 19. PRIORITY ORDER

If time becomes limited:

### MUST HAVE

1.  Mount acquisition.
2.  Mount/unmount state.
3.  Mounted movement speed.
4.  First-person visual mode.
5.  Existing map visible in first-person.
6.  Online mounted state synchronization.

### SHOULD HAVE

7.  Billboard sheep/NPCs.
8.  Mount foreground.
9.  Retro pixel rendering.
10. Mount/unmount transition.

### NICE TO HAVE

11. Hidden Memories visible from mounted mode.
12. Mount-specific jokes.
13. Mount animation.
14. Sound effects.
15. Advanced visual effects.

Never sacrifice the base game's stability for optional polish.

------------------------------------------------------------------------

# 20. DEFINITION OF DONE

The modifier is complete when:

-   Each player can obtain a mount.
-   Each player can mount independently.
-   Mounted movement is faster.
-   Mounting switches that player's camera into first-person.
-   The existing world is still used.
-   The first-person view works while moving around the map.
-   Other players remain synchronized online.
-   Other players can see whether someone is mounted.
-   Dismounting returns the player to normal top-down view.
-   The game remains playable from beginning to ending.
-   No existing quest/collectible progression is broken.

## Final design principle

Do not interpret the modifier as:

> "Build a 3D game."

Interpret it as:

> "Make the act of mounting transform the player's perspective."

The clever solution is to turn the existing 2D RPG map into a retro
pseudo-3D first-person experience without replacing the underlying game.
