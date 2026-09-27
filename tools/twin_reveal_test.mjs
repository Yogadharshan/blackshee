// Focused Phase 5 tests: the twin reveal is a short, unexplained aftermath
// beat that fires TWIN_REVEALED through advanceStory only, after recognition,
// without touching networking, maps, NPCs or mechanics.
import { Game } from '../src/game.js';
import { TILE, AREAS } from '../src/data/world.js';
import { DIALOGUE } from '../src/data/dialogue.js';
import { NPCS } from '../src/data/npcs.js';
import { STORY_BEATS } from '../src/data/story_beats.js';
import { createQuestState } from '../src/systems/quests.js';
import {
  storyStage, advanceStory, twinRevealed, MULTIPLAYER_LOCKED,
} from '../src/systems/story.js';
import { writeSave, loadSave, applySave, clearSave } from '../src/systems/save.js';
import { net } from '../src/systems/net.js';

const noop = () => {};
const ctx = new Proxy({}, {
  get: (t, k) => {
    if (k === 'measureText') return (s) => ({ width: String(s).length * 8 });
    if (k === 'canvas') return { width: 960, height: 640 };
    return noop;
  },
  set: () => true,
});
globalThis.window = { addEventListener: noop };
const realLS = globalThis.localStorage;
globalThis.localStorage = undefined;

let fail = 0;
const check = (cond, msg) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg); if (!cond) fail++; };
const textOf = (key) => DIALOGUE[key].map((l) => (Array.isArray(l) ? l[1] : l)).join(' ');

// --- 1. starts false --------------------------------------------------------
const fresh = createQuestState();
check(fresh.story.twinRevealed === false, 'TWIN_REVEALED starts false on a fresh run');

// --- 2. set only through advanceStory ---------------------------------------
const g = { q: createQuestState() };
check(twinRevealed(g) === false, 'twinRevealed false before any beat');
advanceStory(g, 'TWIN_REVEALED');
check(twinRevealed(g) === true, 'advanceStory(TWIN_REVEALED) sets the flag');

// --- 3. monotonic / cannot be reverted --------------------------------------
const g2 = { q: createQuestState() };
advanceStory(g2, 'TWIN_REVEALED');
advanceStory(g2, 'STAGE_1_FIRST_MEMORY');
advanceStory(g2, 'STAGE_2_FRAGMENTS');
check(twinRevealed(g2) === true, 'a later lower beat cannot revert the twin flag');
check(!('MULTIPLAYER_UNLOCKED' in (await import('../src/systems/story.js'))),
  'MULTIPLAYER_UNLOCKED is not implemented');
check(MULTIPLAYER_LOCKED === true, 'MULTIPLAYER_LOCKED stays true (multiplayer untouched)');

// --- reveal talk about the player-facing wording ----------------------------
const revealText = textOf('baa_reveal');
check(Array.isArray(DIALOGUE.baa_reveal) && DIALOGUE.baa_reveal.every((l) => Array.isArray(l) && typeof l[1] === 'string'),
  'baa_reveal is a well-formed [speaker, text] beat');
check(/second shape/i.test(revealText) && /dark wool/i.test(revealText),
  'the reveal shows one concrete detail (a second shape in the photograph)');
// 4. does not resolve any of the explicitly-unresolved questions.
const forbidden = /twin|identical|separated|disappear|\bwhere\b|\bname\b|visited|\bbrother\b|\bsister\b|\bsibling\b|another black sheep|two of you|grandchildren/i;
check(!forbidden.test(revealText), 'reveal text resolves no twin question (no who/where/why/name/relationship)');
check(!/grandchild/i.test(revealText), 'the family line is not repeated in the reveal');

// --- 8. recognition strictly precedes the reveal, in the real flow ----------
const run = new Game(ctx);
run.mode = 'play';
run.world.setArea('shrine');
run.player.x = 12 * TILE + 7; run.player.y = 7 * TILE + 5;
run.q.memories = run.q.required;
run.q.story.stage = 4;
run.q.sealAnnounced = true;   // as in real play, the 5th Memory already announced the seal
run.q.story.choices.memory = 'move_on';  // pre-answer the Phase 6 Photograph choice (its own verify exists)
check(twinRevealed(run) === false, 'twin flag false before the encounter');
run.advance = true; run.update(1 / 60);          // opens the encounter
check(run.stageBaa === true, 'the Baa sequence is staged (dim + body active)');
check(run.baaRevealAt === DIALOGUE.baa_encounter.length, 'the reveal index is armed after the encounter');

const seen = [];
let flippedIndex = -1;
let guard = 0;
while (run.dialogue.active && guard < 60) {
  seen.push(run.dialogue.current.text);
  run.advance = true; run.update(1 / 60);
  if (flippedIndex < 0 && twinRevealed(run)) flippedIndex = seen.length;
  guard++;
}
check(run.stageBaa === false, 'staging is cleared when the sequence closes');
const iRecognition = seen.findIndex((t) => /My grandchild/.test(t));
const iReveal = seen.findIndex((t) => /second shape/.test(t));
check(iRecognition >= 0, 'recognition beat ("My grandchild") played');
check(iReveal >= 0, 'reveal beat played');
check(iRecognition < iReveal, 'recognition happens strictly before the reveal');
check(flippedIndex < 0 || flippedIndex > iRecognition, 'TWIN_REVEALED fires after recognition');
check(twinRevealed(run) === true, 'twin flag set after the reveal completes');
check(storyStage(run) === 5, 'TWIN_REVEALED raises the stage to 5');
check(run.mode === 'ending', 'the run reaches the provisional end after the reveal');

// --- 6. no twin NPC / player is introduced ----------------------------------
check(NPCS.every((n) => !/twin/i.test(n.id + ' ' + n.name)), 'no twin NPC exists');
check(!run.world.npcs.some((n) => /twin/i.test(n.id)), 'the shrine spawns no twin actor');
check(typeof run.others !== 'undefined' && run.others.size === 0, 'no second player is spawned');

// --- 7. no new map / quest / mechanic ---------------------------------------
const areaKeys = Object.keys(AREAS).sort().join(',');
check(areaKeys === 'farm,forest,hidden,meadow,shrine,village', 'no new map was added');
check(!/twin/i.test(Object.keys(createQuestState()).join(' ')), 'no twin quest/system field exists');

// --- 5. networking is untouched ---------------------------------------------
const origSend = net.send;
let payload = null;
net.send = (p) => { payload = p; };
run.sendState();
net.send = origSend;
check(payload && !('story' in payload) && !('twin' in payload) && !('twinRevealed' in payload),
  'the network payload carries no story/twin state');

// --- beat table: only TWIN_REVEALED may set the flag ------------------------
const setters = STORY_BEATS.filter((b) => b.flag === 'twinRevealed').map((b) => b.id);
check(setters.length === 1 && setters[0] === 'TWIN_REVEALED', 'only TWIN_REVEALED sets twinRevealed');

// --- 9. saves stay compatible -----------------------------------------------
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
clearSave();
const saved = new Game(ctx);
saved.mode = 'play';
advanceStory(saved, 'TWIN_REVEALED');
writeSave(saved);
const loaded = new Game(ctx);
applySave(loaded, loadSave());
check(twinRevealed(loaded) === true, 'save: twinRevealed restored');
const older = new Game(ctx);
applySave(older, { v: 1, area: 'village', x: 5, y: 6, mounted: false, q: { memories: 2 } });
check(twinRevealed(older) === false, 'old save without story -> twinRevealed false');
globalThis.localStorage = realLS;

console.log(fail === 0 ? '\nTWIN REVEAL PASS' : `\nTWIN REVEAL FAIL (${fail})`);
process.exit(fail === 0 ? 0 : 1);