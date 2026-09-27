// Phase 3 — distributed NPC recollections of Baa (handout §9).
//
// Each fragment is owned by exactly ONE NPC and covers one category:
//   object · habit · helped · place · incorrect
// Lines live in data/dialogue.js under the same key. Fragments carry no name,
// no family and nothing legendary — the player performs the reconstruction.
// The 'incorrect' fragment deliberately disagrees with the 'place' fragment and
// is never self-corrected (handout §9).
//
// Delivery: game.js appends a fragment's lines to that NPC's authored dialogue
// the first time the player talks to them, then records it (systems/story.js).
export const NPC_FRAGMENTS = Object.freeze({
  rockSheep: Object.freeze({ id: 'frag_object', dialogue: 'frag_object', category: 'object' }),
  meadowSheep: Object.freeze({ id: 'frag_habit', dialogue: 'frag_habit', category: 'habit' }),
  lonely: Object.freeze({ id: 'frag_helped', dialogue: 'frag_helped', category: 'helped' }),
  farmSheep: Object.freeze({ id: 'frag_place', dialogue: 'frag_place', category: 'place' }),
  suspicious: Object.freeze({ id: 'frag_incorrect', dialogue: 'frag_incorrect', category: 'incorrect' }),
});

export function fragmentFor(npcId) {
  return NPC_FRAGMENTS[npcId] || null;
}