// Ordered narrative milestones for the story-state model.
//
// These are structural labels only — they carry no prose. Each beat maps to a
// story stage (BAA_STAGE_0..5) and is fired by an authored story trigger in a
// later phase. Multiplayer is deliberately absent from this table.
export const STORY_BEATS = Object.freeze([
  Object.freeze({ id: 'STAGE_1_FIRST_MEMORY', stage: 1 }),
  Object.freeze({ id: 'STAGE_2_FRAGMENTS', stage: 2 }),
  Object.freeze({ id: 'STAGE_3_BAA_LIFE', stage: 3 }),
  Object.freeze({ id: 'STAGE_4_FORGOTTEN', stage: 4 }),
  Object.freeze({ id: 'STAGE_5_REMEMBERED', stage: 5 }),
  Object.freeze({ id: 'TWIN_REVEALED', stage: 5, flag: 'twinRevealed' }),
]);

// Which authored Memory advances which narrative beat. The first Memory (any
// item) also fires STAGE_1_FIRST_MEMORY via the generic collection path; these
// entries are the later authored Memories. The Photograph is intentionally
// absent: it is the strongest evidence, but it prepares the later recognition
// rather than advancing a stage on its own.
export const MEMORY_BEATS = Object.freeze({
  bell: 'STAGE_1_FIRST_MEMORY',
  flower: 'STAGE_2_FRAGMENTS',
  toy: 'STAGE_3_BAA_LIFE',
  ribbon: 'STAGE_4_FORGOTTEN',
});
