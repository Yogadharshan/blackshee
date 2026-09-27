// The boundary between game state and any future AI generation.
//
// buildContext() reads game state and returns a small, frozen, constrained
// object. A future LocalSLMProvider must receive ONLY this object — never the
// raw Game. This is what stops the model from seeing (or touching) the world,
// quests, inventory, networking or maps.
//
// baaStage()/emotionalState() are derived here, deterministically, from the
// existing Memory progression. The model never calculates them itself.

import { PERSONAS, DEFAULT_PERSONA, NPC_KNOWLEDGE } from '../data/npc_personas.js';

// Baa lore progression, derived from the existing main-quest state.
// 0 unknown · 1 vague memory · 2 Baa existed · 3 Baa's life
// 4 family clues · 5 lineage revealed
//
// Memories 1–5 walk stages 1–4; the actual lineage reveal (stage 5) only
// exists once the game has reached its resolution (the ending), so the
// "grandchildren" fact can never surface mid-game. This is intentionally not
// tied to the optional secret Memory — it stays deterministic on the main path.
export function baaStage(game) {
  if (!game) return 0;
  if (game.mode === 'ending') return 5;
  const memories = (game.q && game.q.memories) || 0;
  return Math.max(0, Math.min(4, memories));
}

// Intended emotional arc as data: early → middle → late → resolution.
export function emotionalState(game) {
  if (game && game.mode === 'ending') return 'peaceful';
  const memories = (game && game.q && game.q.memories) || 0;
  if (memories <= 1) return 'playful';   // early
  if (memories <= 3) return 'strange';   // middle
  return 'quiet';                        // late
}

// Build a constrained context for one NPC conversation. `intent` and
// `playerLine` default to null; Phase 2 supplies them.
export function buildContext(npcId, game, intent = null, playerLine = null) {
  const persona = PERSONAS[npcId] || DEFAULT_PERSONA;
  const stage = baaStage(game);
  const q = (game && game.q) || {};

  // Hard fact gating: only facts this NPC knows at or below the current stage.
  // A stage-5 fact cannot appear while baaStage < 5.
  const knownFacts = (NPC_KNOWLEDGE[npcId] || [])
    .filter((f) => f.stage <= stage)
    .map((f) => Object.freeze({ text: f.text, stage: f.stage }));

  const location =
    (game && game.world && game.world.def && game.world.def.name) || 'the valley';

  return Object.freeze({
    npc: Object.freeze({ id: persona.id, name: persona.name, voice: persona.voice }),
    personality: persona.personality,
    knownFacts: Object.freeze(knownFacts),
    location,
    memoryCount: Object.freeze({ have: q.memories || 0, required: q.required || 0 }),
    baaStage: stage,
    emotionalState: emotionalState(game),
    intent: intent || null,
    playerLine: playerLine || null,
  });
}
