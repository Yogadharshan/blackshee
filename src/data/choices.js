// Phase 6 — the four authored behavioural choices (design lock §2–§8).
//
// Pure data: no logic and no state mutation. Each choice pairs a stored id with:
//   prompt  — one short authored line shown above the two replies
//   options — exactly two replies; `id` is what systems/story.js writes into
//             q.story.choices, `label` is the player-facing reply
//   lines   — the immediate authored consequence per option (dialogue.js keys)
//
// Storage/mutation stays in systems/story.js (choose). No scores, no meters, no
// history, no personality derivation, no profile. Wording is design intent, not
// canonical (design lock §15 caveat) and may be revised without touching state.
export const CHOICES = Object.freeze({
  flowers: Object.freeze({
    id: 'flowers',
    prompt: 'Baaabara holds the three flowers like they might fly apart.',
    options: Object.freeze([
      Object.freeze({ id: 'careful', label: 'I put them back the way I found them.' }),
      Object.freeze({ id: 'efficient', label: 'Here. Three flowers. That was the task.' }),
    ]),
    lines: Object.freeze({ careful: 'choice_flowers_careful', efficient: 'choice_flowers_efficient' }),
  }),
  friend: Object.freeze({
    id: 'friend',
    prompt: 'Farm Sheep is already looking toward the tree line.',
    options: Object.freeze([
      Object.freeze({ id: 'search', label: 'I will help you look.' }),
      Object.freeze({ id: 'question', label: 'Maybe Bo wanted to leave.' }),
    ]),
    lines: Object.freeze({ search: 'choice_friend_search', question: 'choice_friend_question' }),
  }),
  rock: Object.freeze({
    id: 'rock',
    prompt: 'Rock Sheep waits for you to agree. It is still just a rock.',
    options: Object.freeze([
      Object.freeze({ id: 'respect', label: 'If it matters to you, I will help.' }),
      Object.freeze({ id: 'practical', label: 'It is a rock.' }),
    ]),
    lines: Object.freeze({ respect: 'choice_rock_respect', practical: 'choice_rock_practical' }),
  }),
  memory: Object.freeze({
    id: 'memory',
    prompt: 'You are still holding the photograph.',
    options: Object.freeze([
      Object.freeze({ id: 'investigate', label: 'Wait. Let me look again.' }),
      Object.freeze({ id: 'move_on', label: 'It is just an old photograph.' }),
    ]),
    lines: Object.freeze({ investigate: 'choice_memory_investigate', move_on: 'choice_memory_move_on' }),
  }),
});

export const CHOICE_IDS = Object.freeze(Object.keys(CHOICES));

export function optionIds(choiceId) {
  const c = CHOICES[choiceId];
  return c ? c.options.map((o) => o.id) : [];
}

// Guard for the "only allowed values" requirement (design lock §8 / testing §15).
export function isAllowedOption(choiceId, optionId) {
  return optionIds(choiceId).includes(optionId);
}
