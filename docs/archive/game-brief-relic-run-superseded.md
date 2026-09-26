# Relic Run — Hackathon Game Brief

> Status: **FROZEN SPEC** — no code until explicitly greenlit.
> One-page plan. Everything below is the contract for hackathon day.

## Concept

Web-based, single-player, real-time action RPG ("Pokémon meets WoW" spirit, WoW-side combat).
Looping overworld, top-down 2D, collectathon goal, global leaderboard.

**One-line pitch:** Explore broken zones, fight real-time, collect relic shards, break the boss gate, post your clear time.

## Core loop

```
Explore zone → fight mobs (real-time) → collect relic shards → open boss gate → defeat boss → win → leaderboard
                        └─────────────── sidequests along the way ───────────────┘
```

## Mission structure (collectathon)

- **Goal**: collect **12 relic shards** (3 per zone × 4 zones)
- Shards drop from **zone elites** (1 elite per zone, guaranteed drop)
- All 12 shards → **boss gate unlocks** → final boss → win screen
- Win condition = boss down; score = clear time + completion % (sidequests/collectibles)

## Combat (real-time)

- **Controls**: WASD move, mouse aim, hotbar skills (`1`-`4`), `Space` dodge roll
- **Enemy types**:
  - Chaser (melee, straight-line pursuit)
  - Spitter (ranged, telegraphed projectile)
  - Elite per zone (more HP, one unique attack)
  - Boss (multi-phase: adds → burst → enrage)
- **Fight pacing**: 10-20s standard fights
- **Juice over simulation** (the make-or-break rule):
  - Screen shake, damage numbers, hit flash, knockback, death particles
  - Boring-but-complete beats pretty-but-unfinished every time

## Collectibles & sidequests

| Type | Count | Purpose |
|---|---|---|
| Relic shards | 12 | Mission items (gating) |
| Lore scrolls | 4 | Completion %, world flavor |
| Hidden chests | 4 | Completion %, small reward |

**Sidequests (target 3-5, MVP ships 2):**
- "Hunt 5 zone mobs" → reward: skill upgrade
- "Find my lost item" (hidden chest) → reward: 1 shard equivalent / buff

## Zones (4)

1. Ruined Fields — chasers only, teaches combat
2. Ember Warren — spitters + first elites, introduces ranged threat
3. Frozen Depths — faster enemies, tighter corridors
4. Ashen Keep — elite gauntlet + boss gate

## Tech stack

- **Phaser 3** (2D game framework) + **TypeScript** + **Vite**
- Tilemap: Tiled scene for prototype, code-gen fallback
- Single scene manager; one autosave slot (localStorage)

## Leaderboard

- Solo gameplay, shared scoreboard via **one tiny backend endpoint** (GET/POST)
- Candidates: Netlify function / small Express / Supabase
- **Fallback**: localStorage + shareable hash link (demo-safe, zero backend)
- Stored: clear time, relic count, completion %

## MVP scope (frozen — this is the cut line)

**In (must):**
- [ ] 4 zones, 1 boss, 12 shards
- [ ] 3 skills + dodge
- [ ] 2 sidequests
- [ ] 4 lore scrolls + 4 chests
- [ ] Leaderboard (backend or fallback)
- [ ] Win screen + restart

**Cut (explicitly out of MVP):**
- Crafting, deep inventory UI, equipment slots
- Multiple save slots
- Sound beyond basic SFX
- Any multiplayer-in-world behavior
- Story cutscenes / dialogue systems beyond NPC text lines

## Guardrails / risk flags

- **Real-time combat feel** is the #1 weekend risk → defense is juice: shake, numbers, flash, knockback
- If boss is slipping: ship a tuned "elite +" boss before a broken multi-phase one
- If leaderboard backend is slipping: ship localStorage fallback, note server as stretch
- Timebox per zone at ~2h build; never polish a zone past the cut line

## Build order (hackathon day sequence)

1. Player movement + camera + tilemap (prove the shell)
2. Enemy chaser + basic melee combat + damage numbers
3. Skills hotbar + dodge (feel pass #1: juice)
4. Shard drops + collector UI + gate logic
5. Second zone + spitter
6. Elite + boss
7. Sidequests + collectibles
8. Leaderboard endpoint + win screen
9. Feel pass #2, balance, ship

**Definition of done:** fresh browser load → tutorial zone → 12 shards → boss → win screen → leaderboard entry. No debug console needed.
> SUPERSEDED 2026-09-26 — Relic Run was replaced by the official BLACKSHEE handout (see ../BLackshee_OpenCode_Handout/). Keep only as historical reference; do not build from this.
