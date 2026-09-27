// Focused tests for the Phase 1 story-state model: narrative understanding is
// separate from collection progress, advanced monotonically by named beats,
// with explicit named choices (last-write-wins) and save round-tripping.
import { createQuestState } from '../src/systems/quests.js';
import { STORY_BEATS } from '../src/data/story_beats.js';
import {
  MULTIPLAYER_LOCKED, storyStage, advanceStory, twinRevealed, choose, choice, hasChoice,
} from '../src/systems/story.js';
import { handleHotspot } from '../src/systems/collectibles.js';
import { rewardFor } from '../src/systems/quests.js';
import { writeSave, loadSave, applySave, clearSave } from '../src/systems/save.js';

let fail = 0;
const check = (cond, msg) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg); if (!cond) fail++; };

const game = () => ({
  q: createQuestState(),
  mode: 'play',
  say() {},
  world: { area: 'village', setArea(a) { this.area = a; }, def: { name: 'Sheep Village' } },
  player: { x: 0, y: 0, speed: 170, moving: false },
  mounted: false,
  portalArmed: true,
  portalLockUntil: 0,
  ask: { active: false, answer: null, thinking: false },
});

// --- shape ------------------------------------------------------------------
const g = game();
check(g.q.story && g.q.story.stage === 0 && g.q.story.twinRevealed === false,
  'fresh story: stage 0, no twin reveal');
check(g.q.story.choices && typeof g.q.story.choices === 'object' && Object.keys(g.q.story.choices).length === 0,
  'fresh story: empty explicit choices map');
check(MULTIPLAYER_LOCKED === true, 'MULTIPLAYER_LOCKED is an inert constant (true)');
check(!('multiplayerLocked' in g.q.story), 'MULTIPLAYER_LOCKED is not persisted into story state');

// --- stage advancement is monotonic -----------------------------------------
check(storyStage(null) === 0, 'no game -> stage 0');
advanceStory(g, 'STAGE_2_FRAGMENTS');
check(storyStage(g) === 2, 'advanceStory moves the stage forward');
advanceStory(g, 'STAGE_1_FIRST_MEMORY');
check(storyStage(g) === 2, 'advanceStory never moves the stage backward');
advanceStory(g, 'TWIN_REVEALED');
check(storyStage(g) === 5 && twinRevealed(g) === true, 'TWIN_REVEALED raises the stage and sets the flag');
advanceStory(g, 'NOT_A_BEAT');
check(storyStage(g) === 5, 'an unknown beat is ignored');

// --- choices: explicit, last-write-wins, no history -------------------------
choose(g, 'TEST_CHOICE', 'A');
check(choice(g, 'TEST_CHOICE') === 'A' && hasChoice(g, 'TEST_CHOICE'), 'choose records a named choice');
choose(g, 'TEST_CHOICE', 'B');
check(choice(g, 'TEST_CHOICE') === 'B', 'a second choose overwrites (last-write-wins, no history)');
check(choice(g, 'UNSET') === undefined && hasChoice(g, 'UNSET') === false, 'unset choice reads undefined');
choose(g, '', 'A');
choose(g, 'X', '');
check(!hasChoice(g, '') && !hasChoice(g, 'X'), 'empty ids are ignored');

// --- wiring: authored Memories advance their beats --------------------------
const m = game();
handleHotspot(m, { kind: 'memory', item: 'bell', dialog: 'memory_bell' });
check(m.q.memories === 1 && storyStage(m) === 1, 'Old Bell -> STAGE_1_FIRST_MEMORY');
handleHotspot(m, { kind: 'memory', item: 'toy', dialog: 'memory_toy' });
check(m.q.memories === 2 && storyStage(m) === 3, 'Wooden Toy -> STAGE_3_BAA_LIFE');
handleHotspot(m, { kind: 'memory', item: 'ribbon', dialog: 'memory_ribbon' });
check(storyStage(m) === 4, 'Old Ribbon -> STAGE_4_FORGOTTEN');
handleHotspot(m, { kind: 'memory', item: 'photo', dialog: 'memory_photo' });
check(m.q.memories === 4 && storyStage(m) === 4, 'Photograph adds collection but no new stage');

const f = game();
f.q.flowersGiven = true;
rewardFor('baabara', f);
check(f.q.collected.flower === true && f.q.memories === 1 && storyStage(f) === 2,
  'Red Flower (reward) -> STAGE_2_FRAGMENTS');

const deep = game();
deep.q.story.stage = 4;
handleHotspot(deep, { kind: 'memory', item: 'toy', dialog: 'memory_toy' });
check(storyStage(deep) === 4, 'a Memory cannot regress a later story stage');

// --- beat table integrity ----------------------------------------------------
check(STORY_BEATS.every((b) => typeof b.id === 'string' && b.stage >= 0),
  'every beat has an id and a stage');
check(new Set(STORY_BEATS.map((b) => b.id)).size === STORY_BEATS.length, 'beat ids are unique');

// --- save round-trip + old-save compatibility -------------------------------
const store = new Map();
const realLS = globalThis.localStorage;
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

clearSave();
const a = game();
a.q.story.stage = 3;
a.q.story.twinRevealed = true;
choose(a, 'TEST_CHOICE', 'OPT_A');
writeSave(a);
const b = game();
applySave(b, loadSave());
check(b.q.story.stage === 3, 'save: story stage restored');
check(b.q.story.twinRevealed === true, 'save: twinRevealed restored');
check(choice(b, 'TEST_CHOICE') === 'OPT_A', 'save: named choice restored');

const partial = { v: 1, area: 'village', x: 5, y: 6, mounted: false, q: { memories: 2, side: { flowers: 'done' } } };
const c = game();
applySave(c, partial);
check(c.q.story && c.q.story.stage === 0, 'old save without story -> stage 0 default (no Memory floor)');
check(c.q.memories === 2 && c.q.side.flowers === 'done', 'old save keeps collection + quest state');
check(c.q.story.choices && Object.keys(c.q.story.choices).length === 0, 'old save gets an empty choices map');

globalThis.localStorage = realLS;

console.log(fail === 0 ? '\nSTORY STATE PASS' : `\nSTORY STATE FAIL (${fail})`);
process.exit(fail === 0 ? 0 : 1);
