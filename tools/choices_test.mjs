// Focused Phase 6 tests: four authored behavioural choices, each stored only in
// q.story.choices through systems/story.js, each with an immediate consequence
// (and two later callbacks). Choices never gate the main story, Baa recognition,
// the twin reveal, multiplayer, maps or AI.
import { Game } from '../src/game.js';
import { TILE, AREAS } from '../src/data/world.js';
import { DIALOGUE } from '../src/data/dialogue.js';
import { NPCS } from '../src/data/npcs.js';
import { createQuestState, talkFor } from '../src/systems/quests.js';
import { CHOICES, CHOICE_IDS, optionIds, isAllowedOption } from '../src/data/choices.js';
import {
  choice, hasChoice, choose, storyStage, twinRevealed, MULTIPLAYER_LOCKED,
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

// Drive an active dialogue to completion, auto-picking the choice at `pick`
// (mirrors the headless playthrough: E confirms the highlighted reply).
function drive(g, pick = 0) {
  const seen = [];
  let guard = 0;
  while (g.dialogue.active && guard < 90) {
    if (g.dialogue.choosing) {
      seen.push('CHOICE ' + g.dialogue.current.text);
      g.dialogue.pickChoice(pick);
    } else {
      seen.push(g.dialogue.current.text);
      g.advance = true;
      g.update(1 / 60);
    }
    guard++;
  }
  return seen;
}

// --- A. shape: exactly four choices, two allowed values each ----------------
const allowedByDesign = {
  flowers: ['careful', 'efficient'],
  friend: ['search', 'question'],
  rock: ['respect', 'practical'],
  memory: ['investigate', 'move_on'],
};
check(CHOICE_IDS.length === 4, 'exactly four choices exist');
check(CHOICE_IDS.slice().sort().join(',') === 'flowers,friend,memory,rock', 'the four canonical choice ids');
for (const id of CHOICE_IDS) {
  const c = CHOICES[id];
  check(c.options.length === 2, `${id}: exactly two options`);
  check(optionIds(id).join(',') === allowedByDesign[id].join(','), `${id}: only the design-locked values`);
  check(c.options.every((o) => typeof o.label === 'string' && o.label.trim().length > 3), `${id}: every option has a readable reply`);
  check(c.lines && Object.keys(c.lines).length === 2, `${id}: a consequence per option`);
  for (const k of Object.values(c.lines)) {
    const lines = DIALOGUE[k];
    check(Array.isArray(lines) && lines.length > 0 && lines.every((l) => Array.isArray(l) && typeof l[1] === 'string'),
      `${id}: consequence ${k} is a well-formed beat`);
  }
}

// --- B. persistence: q.story.choices, allowed values only --------------------
const q0 = createQuestState();
check(Object.keys(q0.story.choices).length === 0, 'fresh state: no choices recorded');
const g = { q: createQuestState() };
choose(g, 'flowers', 'careful');
check(choice(g, 'flowers') === 'careful' && hasChoice(g, 'flowers'), 'a choice writes to q.story.choices');
choose(g, 'flowers', 'efficient');
check(choice(g, 'flowers') === 'efficient', 'last write wins (no history)');
for (const id of CHOICE_IDS) {
  for (const v of allowedByDesign[id]) check(isAllowedOption(id, v), `${id}: "${v}" is allowed`);
  check(!isAllowedOption(id, 'nonsense'), `${id}: arbitrary values are rejected`);
}

// --- C. the four choices stay independent -----------------------------------
const gi = { q: createQuestState() };
choose(gi, 'rock', 'practical');
check(choice(gi, 'rock') === 'practical', 'rock recorded');
check(!hasChoice(gi, 'flowers') && !hasChoice(gi, 'friend') && !hasChoice(gi, 'memory'), 'recording one does not set the others');

// --- D. immediate consequence is authored & reachable in the real flow ------
const rg = new Game(ctx);
rg.mode = 'play';
rg.world.setArea('village');
const rock = rg.world.npcs.find((n) => n.id === 'rockSheep');
rg.player.x = rock.px + 20 - 34; rg.player.y = rock.py + 20 + 2;
rg.advance = true; rg.update(1 / 60);                    // opens the authored offer
let guard = 0;
while (rg.dialogue.active && !rg.dialogue.choosing && guard < 30) { rg.advance = true; rg.update(1 / 60); guard++; }
check(rg.dialogue.choosing, 'the rock offer opens a choice');
check(rg.dialogue.choice.options.length === 2, 'the choice shows two replies');
check(!hasChoice(rg, 'rock'), 'nothing is recorded before a pick');
rg.dialogue.pickChoice(1);                               // practical
check(choice(rg, 'rock') === 'practical', 'the pick records the allowed value');
check(rg.dialogue.active && !rg.dialogue.choosing, 'the authored consequence plays after the pick');
check(/it is a rock/i.test(textOf('choice_rock_practical')), 'the practical consequence is the authored one');
guard = 0; while (rg.dialogue.active && guard < 20) { rg.advance = true; rg.update(1 / 60); guard++; }
check(hasChoice(rg, 'rock'), 'the choice persists after the flow');
if (rg.ask.active) rg.closeAsk();

// Drive until the NPC's authored opening closes and the choice appears.
function untilChoosing(g, max = 30) {
  let guard = 0;
  while (guard < max && g.dialogue.active && !g.dialogue.choosing) {
    g.advance = true; g.update(1 / 60);
    guard++;
  }
  return g.dialogue.choosing;
}

// --- D2. the other two choices are reachable in their own real flows --------
const bg = new Game(ctx);
bg.mode = 'play';
bg.world.setArea('village');
const bar = bg.world.npcs.find((n) => n.id === 'baabara');
bg.player.x = bar.px + 20 - 34; bg.player.y = bar.py + 20 + 2;
bg.q.flowers = 3;
bg.advance = true; bg.update(1 / 60);
check(untilChoosing(bg) === true, 'the flower hand-in offers the flowers choice');
bg.dialogue.pickChoice(0);
check(choice(bg, 'flowers') === 'careful', 'flowers: the pick records the careful reply');
let fgGuard = 0; while (bg.dialogue.active && fgGuard < 20) { bg.advance = true; bg.update(1 / 60); fgGuard++; }
check(bg.q.collected.flower === true && bg.q.memories === 1, 'the flower reward still lands after the choice');
if (bg.ask.active) bg.closeAsk();

const fg = new Game(ctx);
fg.mode = 'play';
fg.world.setArea('farm');
const fs = fg.world.npcs.find((n) => n.id === 'farmSheep');
fg.player.x = fs.px + 20 - 34; fg.player.y = fs.py + 20 + 2;
fg.advance = true; fg.update(1 / 60);
check(untilChoosing(fg) === true, 'the friend offer opens the friend choice');
fg.dialogue.pickChoice(1);
check(choice(fg, 'friend') === 'question', 'friend: the pick records the question reply');
if (fg.ask.active) fg.closeAsk();

// --- E. later callbacks (friend + rock) -------------------------------------
const qRock = createQuestState();
qRock.hasRock = true; qRock.story.choices.rock = 'respect';
check(talkFor('rockSheep', qRock).some((l) => /came back for it/i.test(l[1] || '')), 'rock: respect callback on hand-in');
const qRock2 = createQuestState();
qRock2.hasRock = true; qRock2.story.choices.rock = 'practical';
check(talkFor('rockSheep', qRock2).some((l) => /for a rock/i.test(l[1] || '')), 'rock: practical callback on hand-in');
const qRock3 = createQuestState();
qRock3.hasRock = true;
check(!talkFor('rockSheep', qRock3).some((l) => /came back for it|for a rock/i.test(l[1] || '')),
  'rock: no callback without a recorded choice');

const qFr = createQuestState();
qFr.boFound = true; qFr.story.choices.friend = 'search';
check(talkFor('farmSheep', qFr).some((l) => /do not give up easily/i.test(l[1] || '')), 'friend: search callback after Bo');
const qFr2 = createQuestState();
qFr2.boFound = true; qFr2.story.choices.friend = 'question';
check(talkFor('farmSheep', qFr2).some((l) => /thinking about what you said/i.test(l[1] || '')), 'friend: question callback after Bo');

// --- F. Photograph choice does not reveal the twin --------------------------
const forbidden = /twin|identical|separated|disappear|\bbrother\b|\bsister\b|\bsibling\b|another black sheep|two of you|grandchild|dark wool|second shape/i;
for (const k of ['choice_memory_investigate', 'choice_memory_move_on']) {
  check(!forbidden.test(textOf(k)), `${k}: reveals nothing about the twin`);
}

// --- G. main story is convergent regardless of choices ----------------------
function altarRun(choices, pick) {
  const run = new Game(ctx);
  run.mode = 'play';
  run.world.setArea('shrine');
  run.player.x = 12 * TILE + 7; run.player.y = 7 * TILE + 5;
  run.q.memories = run.q.required;
  run.q.story.stage = 4;
  run.q.sealAnnounced = true;
  Object.assign(run.q.story.choices, choices);
  run.advance = true; run.update(1 / 60);
  const seen = drive(run, pick);
  if (run.ask.active) run.closeAsk();
  return { run, seen };
}
const comboA = { flowers: 'careful', friend: 'search', rock: 'respect' };
const comboB = { flowers: 'efficient', friend: 'question', rock: 'practical' };
const a = altarRun(comboA, 0);
const b = altarRun(comboB, 1);
for (const { run, seen, tag } of [{ ...a, tag: 'A' }, { ...b, tag: 'B' }]) {
  check(seen.some((t) => /My grandchild/.test(t)), `run ${tag}: Baa recognizes the grandson`);
  check(seen.some((t) => /second shape/i.test(t)), `run ${tag}: the twin reveal still fires`);
  check(twinRevealed(run) === true, `run ${tag}: TWIN_REVEALED set`);
  check(storyStage(run) === 5, `run ${tag}: stage 5`);
  check(run.mode === 'ending', `run ${tag}: reaches the ending`);
}
check(a.run.q.story.choices.memory === 'investigate', 'run A stored the first reply (investigate)');
check(b.run.q.story.choices.memory === 'move_on', 'run B stored the second reply (move_on)');
check(choice(a.run, 'flowers') === 'careful' && choice(b.run, 'flowers') === 'efficient',
  'pre-existing choices are untouched by the altar flow');

// --- H. Baa recognition + twin reveal text are independent of choices -------
check(/My grandchild/.test(textOf('baa_encounter')), 'recognition wording is authored, not choice-derived');
check(!/grandchild/i.test(textOf('baa_reveal')), 'twin reveal wording unchanged by Phase 6');

// --- I. no new NPC / map / quest, multiplayer untouched ---------------------
check(NPCS.every((n) => !/twin/i.test(n.id + ' ' + n.name)), 'no new NPC introduced');
const areaKeys = Object.keys(AREAS).sort().join(',');
check(areaKeys === 'farm,forest,hidden,meadow,shrine,village', 'no new map introduced');
check(MULTIPLAYER_LOCKED === true, 'multiplayer stays locked');
const origSend = net.send;
let payload = null;
net.send = (p) => { payload = p; };
new Game(ctx).sendState();
net.send = origSend;
check(payload && !('story' in payload) && !('choices' in payload), 'choices are never sent over the network');

// --- J. save/load keeps every choice ----------------------------------------
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
clearSave();
const sv = new Game(ctx);
sv.mode = 'play';
choose(sv, 'flowers', 'careful');
choose(sv, 'friend', 'question');
choose(sv, 'rock', 'practical');
choose(sv, 'memory', 'investigate');
writeSave(sv);
const ld = new Game(ctx);
applySave(ld, loadSave());
check(choice(ld, 'flowers') === 'careful' && choice(ld, 'friend') === 'question'
  && choice(ld, 'rock') === 'practical' && choice(ld, 'memory') === 'investigate',
  'save: all four choices restored');
const older = new Game(ctx);
applySave(older, { v: 1, area: 'village', x: 5, y: 6, mounted: false, q: { memories: 2 } });
check(Object.keys(older.q.story.choices).length === 0, 'old save without choices -> empty choices map');
globalThis.localStorage = realLS;

console.log(fail === 0 ? '\nCHOICES PASS' : `\nCHOICES FAIL (${fail})`);
process.exit(fail === 0 ? 0 : 1);
