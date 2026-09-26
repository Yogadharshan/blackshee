# BLACKSHEE — SECRET AREA MODIFIER HANDOUT

## Modifier

**Hide one area that rewards curiosity, with a unique collectible you can't get anywhere else.**

This modifier is a core part of the Blackshee game, not an optional decoration.

The secret should reward players who notice strange details, experiment, and explore beyond the obvious path.

---

# 1. SECRET CONCEPT

## The Place Behind the Tree

A strange tree exists near the edge of the normal playable area.

It should not look like an obvious "secret entrance."

It should simply look slightly wrong or suspicious.

Possible environmental clues:

- the tree is positioned strangely;
- its shadow does not line up perfectly;
- there is a tiny gap behind it;
- flowers form an unusual pattern around it;
- it is slightly different from nearby trees.

The player should think:

> "Why is that tree like that?"

Not:

> "This is clearly a secret entrance."

---

# 2. DISCOVERY SHOULD HAVE MULTIPLE LAYERS

The secret should combine four kinds of curiosity:

### 1. Environmental curiosity

The tree looks slightly unusual.

The player notices something visually inconsistent.

### 2. NPC/dialogue curiosity

A nearby sheep comments on the tree.

Example:

> "Oh, that tree?"

> "There's nothing behind it."

Pause.

> "Definitely nothing."

This should make the tree MORE suspicious.

### 3. Mechanical experimentation

The players can interact with the tree.

First interaction:

> "It's a tree."

Second:

> "Still a tree."

Third:

> "You are becoming very familiar with this tree."

The game should reward repeated experimentation rather than immediately revealing the solution.

### 4. Co-op experimentation

The secret is discovered when both Blackshee are behind/interacting with the tree at the same time.

Possible sequence:

Player 1 stands behind tree.

Nothing.

Player 2 stands behind tree.

Nothing.

Both are positioned correctly.

The tree reacts:

> *rustle*

Then:

> **A hidden path appeared.**

Do not explicitly tell the players that both players need to stand there.

They should discover this by experimenting.

---

# 3. SECRET AREA

The hidden area must be very small.

Target playtime:

**20–40 seconds.**

Structure:

```text
Normal world
    ↓
Suspicious tree
    ↓
Hidden entrance
    ↓
Tiny secret room
    ↓
Strange sheep
    ↓
Unique collectible
```

Do not create another full biome or dungeon.

The purpose is discovery, not additional content volume.

---

# 4. SECRET NPC

The room contains one strange sheep.

Working role:

**The Sheep Who Knows Too Much**

Tone:

- strange
- mildly annoyed
- self-aware
- funny
- not hostile

Possible dialogue:

> "Oh."

> "You found this."

> "That's inconvenient."

Interact again:

> "Please leave."

Again:

> "I'm serious."

Again:

> "Fine."

Then:

> "Do you want the thing or not?"

The sheep gives the unique collectible.

Keep the dialogue short.

---

# 5. UNIQUE COLLECTIBLE

## The Sixth Memory

The main game contains exactly five required Memories.

The secret area contains a special collectible:

**THE SIXTH MEMORY**

It cannot be obtained anywhere else.

It is NOT required to complete the main quest.

Inventory/inspection text:

> **THE SIXTH MEMORY**

> *This memory hasn't happened yet.*

This should immediately feel different from the five normal Memories.

Do not explain exactly what it means.

The ambiguity is intentional.

---

# 6. LORE CONNECTION

The main game has five Memories connected to the forgotten Blackshee history.

The Sixth Memory is different.

It is apparently a memory of something that has not happened yet.

This creates a small mystery.

Do not build a complicated time-travel system.

Do not create another questline.

The item itself is the mystery.

---

# 7. FINAL PAYOFF

If the players reach the final shrine without the Sixth Memory:

Normal dialogue proceeds.

If they have the Sixth Memory:

The shrine recognizes that something is wrong.

Example:

> "Five memories are enough."

Pause.

> "..."

> "Why do you have six?"

Pause.

> "That wasn't supposed to happen."

Then continue normally.

Do NOT explain the Sixth Memory.

The player should be left wondering what it means.

---

# 8. HUMOR RULE

The secret should have a funny discovery process but should not become a comedy sketch.

The ideal emotional sequence is:

```text
Hmm, weird tree.
        ↓
Why did that sheep say that?
        ↓
Let's poke it.
        ↓
Nothing.
        ↓
Wait, what if both of us do it?
        ↓
SECRET!
        ↓
This sheep is weird.
        ↓
This collectible is weird.
        ↓
Wait... "hasn't happened yet"?
        ↓
Later: "Why do you have six?"
```

The mystery should survive the jokes.

---

# 9. IMPLEMENTATION

Do not create a new gameplay system.

The secret only requires:

- one hidden area;
- one environmental clue;
- one NPC;
- one interaction condition;
- one unique collectible;
- one shared-state flag;
- one conditional dialogue branch at the shrine.

Suggested state:

```js
state.secret = {
  discovered: false,
  sixthMemoryCollected: false
}
```

The hidden entrance condition can be as simple as:

```text
player1 is inside trigger
AND
player2 is inside trigger
AND
both players interact
```

Once activated:

```text
secret.discovered = true
```

The area remains accessible afterward.

---

# 10. MULTIPLAYER REQUIREMENT

The secret must use shared game state.

If Player 1 discovers it:

Player 2 should also see the secret area as discovered.

If either player collects the Sixth Memory:

Both players should have it in the shared game state.

The shrine's special dialogue should trigger for both players.

Do not create separate copies of the collectible for each player.

---

# 11. DISCOVERY DESIGN RULE

Do NOT put:

- a quest marker;
- an objective marker;
- "SECRET AREA" text;
- an explicit hint saying "stand here together";
- an arrow pointing to the tree.

The secret should be discoverable through observation and experimentation.

However, it should not be pixel-perfectly hidden.

The environmental clue should make the area reasonably discoverable to curious players.

---

# 12. SCOPE PROTECTION

This modifier must remain tiny.

Do NOT add:

- a secret dungeon;
- enemies;
- combat;
- a new progression system;
- a new currency;
- a second quest chain;
- a complicated puzzle;
- procedural secret generation;
- multiple secret rooms.

One hidden area.

One unique collectible.

One small lore payoff.

That's enough.

---

# 13. DEFINITION OF DONE

The modifier is complete when:

- [ ] The tree looks slightly suspicious.
- [ ] A nearby sheep provides an indirect clue.
- [ ] The tree can be experimented with.
- [ ] The secret requires both players to discover.
- [ ] The hidden area is accessible.
- [ ] The strange sheep is present.
- [ ] The Sixth Memory exists.
- [ ] The Sixth Memory cannot be obtained elsewhere.
- [ ] The collectible is shared between players.
- [ ] The shrine recognizes the Sixth Memory.
- [ ] The secret does not block the main ending.
- [ ] The secret remains optional.
