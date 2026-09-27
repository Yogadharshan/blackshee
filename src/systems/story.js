// Story state: narrative understanding/progression, kept separate from
// collection progress (q.memories / q.collected).
//
// This is the single mutation surface for q.story. Game state owns the truth;
// the AI only ever receives derived context (buildContext) and never writes
// here. Multiplayer must not read or gate on any of this.
import { STORY_BEATS } from '../data/story_beats.js';

// Dormant future flag: multiplayer is locked in this build and is intentionally
// independent of story state. Not persisted, not read by networking, never
// unlocked here. (MULTIPLAYER_UNLOCKED is intentionally not implemented.)
export const MULTIPLAYER_LOCKED = true;

const MAX_STAGE = 5;
const clampStage = (n) => Math.max(0, Math.min(MAX_STAGE, Number(n) | 0));

function store(game) {
  return game && game.q && game.q.story ? game.q.story : null;
}

// Current narrative stage (0..5). 0 when there is no story state.
export function storyStage(game) {
  const s = store(game);
  return s ? clampStage(s.stage) : 0;
}

// Advance the story to a named beat. Monotonic by design: a beat can only move
// the stage forward, so replaying an event or reloading a save cannot regress it.
export function advanceStory(game, beatId) {
  const s = store(game);
  const beat = STORY_BEATS.find((b) => b.id === beatId);
  if (!s || !beat) return;
  if (beat.stage > clampStage(s.stage)) s.stage = beat.stage;
  if (beat.flag) s[beat.flag] = true;
}

export function twinRevealed(game) {
  const s = store(game);
  return !!(s && s.twinRevealed);
}

// Distinct authored NPC recollections (data/npc_fragments.js) the player has
// heard. These are counted, not ordered: the stage rises as understanding
// accumulates, so free exploration order can never lock the player out.
export function hasFragment(game, id) {
  const s = store(game);
  return !!(s && s.fragments && id && s.fragments[id]);
}

export function fragmentCount(game) {
  const s = store(game);
  return s && s.fragments ? Object.keys(s.fragments).length : 0;
}

// How many distinct fragments map to each understanding beat. Order-independent
// by design (handout §23): the accumulated recollections, not a collection path.
const FRAGMENT_STAGE_LADDER = Object.freeze([
  Object.freeze({ at: 1, beat: 'STAGE_2_FRAGMENTS' }),
  Object.freeze({ at: 3, beat: 'STAGE_3_BAA_LIFE' }),
  Object.freeze({ at: 5, beat: 'STAGE_4_FORGOTTEN' }),
]);

// Record a heard fragment once and raise the stage from accumulated count.
// Returns false when the fragment was already known (safe to re-talk).
export function recordFragment(game, id) {
  const s = store(game);
  if (!s || !id) return false;
  if (!s.fragments || typeof s.fragments !== 'object') s.fragments = {};
  if (s.fragments[id]) return false;
  s.fragments[id] = true;
  const n = Object.keys(s.fragments).length;
  for (const step of FRAGMENT_STAGE_LADDER) {
    if (n >= step.at) advanceStory(game, step.beat);
  }
  return true;
}

// Explicit named choices: q.story.choices[choiceId] = optionId, last write wins.
// No history, no meters. Authored choices are added in a later phase.
export function choose(game, choiceId, optionId) {
  const s = store(game);
  if (!s || !choiceId || !optionId) return;
  if (!s.choices || typeof s.choices !== 'object') s.choices = {};
  s.choices[choiceId] = optionId;
}

export function choice(game, choiceId) {
  const s = store(game);
  return s && s.choices ? s.choices[choiceId] : undefined;
}

export function hasChoice(game, choiceId) {
  const s = store(game);
  return !!(s && s.choices && Object.prototype.hasOwnProperty.call(s.choices, choiceId));
}
