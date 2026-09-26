# BLACKSHEE --- GAME DESIGN SPEC

## World

Everything is sheep.

The player is the only black sheep.

The world is a small colorful retro countryside composed of a few
connected areas.

Suggested areas:

-   Sheep Village
-   Meadow
-   Farm
-   Forest
-   Old Shrine

The map can be compact. The player should be able to understand its
geography quickly.

## Main quest

Title: THE FIVE MEMORIES

Objective: Find 5 Memories hidden around the world.

Each Memory should be a physical collectible or interaction.

Suggested Memories: - Old Bell - Red Flower - Wooden Toy - Old Ribbon -
Photograph

These names are placeholders. Keep whichever set is easiest to
implement.

The important property is that each Memory should feel like an object
that belongs to the world, not a generic coin.

## Quest progression

START → player receives the mission → explore world → collect Memories →
counter reaches 5/5 → final gate opens → enter Old Shrine → final
encounter → ending

The player should always be able to see the current main objective.

## Sidequests

Implement 3 simple sidequests.

### Sidequest A --- Missing Flower

A sheep asks the player to find 3 flowers.

Flow: Talk → find 3 flowers → return → reward.

Reward can be dialogue, a Memory, or access to a small area.

### Sidequest B --- Missing Friend

A sheep claims their tiny friend disappeared.

The friend is nearby or hidden in an amusing location.

Flow: Talk → explore → find friend → return.

The joke should come from the situation, not from complicated mechanics.

### Sidequest C --- Extremely Important Object

A sheep asks for a ridiculous object.

Example: "Please find my very important rock."

The player finds it.

The sheep accepts it even if it is obviously the wrong rock.

Optional joke: The correct rock was beside the sheep the entire time.

## NPC personality

Use small, memorable characters rather than lots of generic NPCs.

Examples:

### Elder Sheep

Provides the main mission. Mostly sincere. Occasionally confused.

### Baaabara

Quest-giver for the flower quest. Treats flowers with ridiculous
seriousness.

### Rock Sheep

Obsessed with rocks. Can become a recurring joke.

### Suspicious Sheep

Acts like they know the player is being watched. May be connected to a
secret.

### Lonely Sheep

Provides a small sincere moment. Do not make the character melodramatic.

## Undertale-like humor principles

Do not copy Undertale characters, dialogue, names, visual assets, or
exact jokes.

Borrow only the high-level interaction style: - repeated interactions
can change dialogue - NPCs can notice strange player behavior - some
objects can talk - characters can acknowledge game conventions - jokes
can escalate - a stupid interaction can unexpectedly become meaningful

Example:

Player interacts with sign: "DO NOT ENTER."

Again: "You already read this."

Again: "Why are you doing this?"

Again: "..."

Again: "Fine."

Then optionally reveal a tiny secret.

## Blackshee jokes

The black sheep identity should create recurring low-cost jokes.

Examples:

NPC: "You're... different."

Player approaches a white sheep.

Sheep: "Whoa."

Pause.

Sheep: "Your wool is... extremely night."

Another sheep: "Don't worry. We accept all sheep."

Pause.

"...mostly."

Keep these jokes occasional.

Do not make discrimination the entire premise.

## Secret design

### Secret 1 --- Repeated interaction

An object becomes increasingly annoyed when repeatedly examined.

### Secret 2 --- Hidden developer-style joke

A hidden NPC says something like: "You found the place nobody was
supposed to look."

Then: "Please do not tell the judges."

Keep this generic enough to survive if the hackathon context changes.

### Secret 3 --- Hidden room

A small off-path area contains an unusual sheep or object.

It should reward curiosity with: - unique dialogue - a cosmetic joke - a
bonus collectible - or a strange ending variation

It must not be necessary to win.

## Final encounter

Avoid implementing conventional combat unless there is already a stable
combat system.

The final encounter should instead be a short sequence.

Possible structure:

Enter shrine → interact with final object/NPC → reveal why the Memories
matter → player makes one simple interaction/choice → ending

The exact emotional reveal can be refined after the functional prototype
exists.

## Ending

The ending should be short.

The player should understand: - they completed the mission; - the
collected objects had meaning; - the black sheep's difference mattered
to the story; - the world continues after the player leaves.

Avoid a long cutscene.

## Failure modes to avoid

-   huge map
-   dozens of NPCs
-   combat system
-   complex inventory
-   procedural generation
-   dialogue trees
-   crafting
-   shops
-   character stats
-   leveling
-   multiplayer
-   backend
-   accounts
-   save system
-   elaborate animation system

These are not needed for the hackathon.
