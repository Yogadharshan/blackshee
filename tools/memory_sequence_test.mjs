// Focused tests for the Phase 2 Memory sequence: the five Memories are
// collectible, their beats are well-formed (no bare-string lines), each fires
// the right story beat, the stage never regresses, and nothing spoils the
// later recognition (no name, no family, no twin, no stage 5).
import { DIALOGUE } from '../src/data/dialogue.js';
import { HOTSPOTS } from '../src/data/collectibles.js';
import { MEMORY_BEATS } from '../src/data/story_beats.js';
import { Dialogue } from '../src/systems/dialogue.js';
import { handleHotspot } from '../src/systems/collectibles.js';
import { rewardFor } from '../src/systems/quests.js';
import { createQuestState } from '../src/systems/quests.js';
import { storyStage, twinRevealed } from '../src/systems/story.js';

let fail = 0;
const check = (cond, msg) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg); if (!cond) fail++; };

const game = () => ({
  q: createQuestState(),
  mode: 'play',
  say() {},
  world: { area: 'village', setArea(a) { this.area = a; }, def: { name: 'Sheep Village' } },
});

const MEMORY_KEYS = ['memory_bell', 'memory_toy', 'memory_ribbon', 'memory_photo', 'memory_flower_reward', 'baabara_done'];
const textOf = (key) => DIALOGUE[key].map((l) => (Array.isArray(l) ? l[1] : l)).join(' ');

// --- 1. all five Memories remain collectible --------------------------------
const hotspotItems = HOTSPOTS.filter((h) => h.kind === 'memory').map((h) => h.item);
for (const item of ['bell', 'toy', 'ribbon', 'photo']) {
  check(hotspotItems.includes(item), `Memory collectible as a hotspot: ${item}`);
}
check(!hotspotItems.includes('flower'), 'Red Flower is a reward (not a hotspot), as before');

// --- 2. beats are well-formed pairs (guards the bare-string bug) ------------
for (const key of MEMORY_KEYS) {
  const pairs = DIALOGUE[key];
  const allPairs = Array.isArray(pairs) && pairs.length > 0 && pairs.every((l) => Array.isArray(l) && typeof l[1] === 'string');
  check(allPairs, `${key}: every line is a [speaker, text] pair`);
  const d = new Dialogue();
  d.start(pairs);
  let ok = true;
  while (d.active) {
    const cur = d.current;
    if (!cur || typeof cur.text !== 'string' || cur.text.trim().length <= 1) ok = false;
    d.advance();
  }
  check(ok, `${key}: every page renders real text (no 1-char garble)`);
}

// --- 3. no premature spoilers in the Memory beats ---------------------------
const allMemoryText = MEMORY_KEYS.map(textOf).join(' ');
check(!/\bbaa\b/i.test(allMemoryText), 'Memory beats do not name Baa');
check(!/grandson|granddaughter|grandchild/i.test(allMemoryText), 'Memory beats do not name the grandson');
check(!/\btwin\b|\bbrother\b|\bsister\b|\bsibling\b/i.test(allMemoryText), 'Memory beats do not establish the twin');
check(!/\b(he|she|his|her|hers)\b/i.test(allMemoryText), 'Memory beats use no gendered pronoun for Baa');

// The Photograph is the strongest Memory but must not explain the story.
const photoText = textOf('memory_photo');
check(!/grandson|grandchild|twin|family/i.test(photoText), 'Photograph does not reveal the family answer');

// --- 4. collection + beat wiring --------------------------------------------
check(MEMORY_BEATS.bell === 'STAGE_1_FIRST_MEMORY' && MEMORY_BEATS.flower === 'STAGE_2_FRAGMENTS'
  && MEMORY_BEATS.toy === 'STAGE_3_BAA_LIFE' && MEMORY_BEATS.ribbon === 'STAGE_4_FORGOTTEN',
  'MEMORY_BEATS maps bell/flower/toy/ribbon to stages 1..4');
check(!('photo' in MEMORY_BEATS), 'Photograph advances no stage on its own');

// Photograph first: still just stage 1, nothing spoiled.
const photoFirst = game();
handleHotspot(photoFirst, { kind: 'memory', item: 'photo', dialog: 'memory_photo' });
check(photoFirst.q.memories === 1 && storyStage(photoFirst) === 1,
  'Photograph as first Memory -> stage 1 (does not jump the narrative)');

// Full collection, out of order, monotonic stage, never reaching 5.
const g = game();
let minStage = 0, regressed = false;
for (const item of ['toy', 'photo', 'flower', 'bell', 'ribbon']) {
  if (item === 'flower') {
    g.q.flowersGiven = true;
    rewardFor('baabara', g);
  } else {
    handleHotspot(g, { kind: 'memory', item, dialog: 'memory_' + item });
  }
  if (storyStage(g) < minStage) regressed = true;
  minStage = Math.max(minStage, storyStage(g));
}
check(g.q.memories === 5, 'all five Memories collected (progress intact)');
check(!regressed, 'the stage never moves backward across a Mixed order');
check(storyStage(g) === 4, 'final narrative stage is 4 (STAGE_5_REMEMBERED not implemented)');
check(twinRevealed(g) === false, 'TWIN_REVEALED not implemented in this phase');

console.log(fail === 0 ? '\nMEMORY SEQUENCE PASS' : `\nMEMORY SEQUENCE FAIL (${fail})`);
process.exit(fail === 0 ? 0 : 1);
