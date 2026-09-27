// Focused Phase 3/4 tests: distributed NPC fragments, the intentional
// contradiction, light/unconfirming twin foreshadowing, and the Forgotten Baa
// recognition encounter. Drives a real Game with the same stubs as smoke.mjs.
import { Game } from '../src/game.js';
import { TILE } from '../src/data/world.js';
import { DIALOGUE } from '../src/data/dialogue.js';
import { NPC_FRAGMENTS, fragmentFor } from '../src/data/npc_fragments.js';
import { Dialogue } from '../src/systems/dialogue.js';
import { hasFragment, fragmentCount, storyStage } from '../src/systems/story.js';
import { buildContext } from '../src/systems/npc_context.js';

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
globalThis.localStorage = undefined;

let fail = 0;
const check = (cond, msg) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg); if (!cond) fail++; };

const game = () => new Game(ctx);
const textOf = (key) => DIALOGUE[key].map((l) => (Array.isArray(l) ? l[1] : l)).join(' ');
const finishDialogue = (g) => {
  let guard = 0;
  while (g.dialogue.active && guard < 40) { g.advance = true; g.update(1 / 60); guard++; }
  if (g.ask.active) g.closeAsk();
};

// --- 1/2. Fragment ownership: one category per NPC, distinct owners ---------
const owners = Object.keys(NPC_FRAGMENTS);
const cats = owners.map((o) => NPC_FRAGMENTS[o].category);
check(owners.length === 5, `five fragment owners (${owners.join(', ')})`);
check(new Set(cats).size === 5, 'five distinct fragment categories');
for (const c of ['object', 'habit', 'helped', 'place', 'incorrect']) {
  check(cats.includes(c), `category covered: ${c}`);
}
check(fragmentFor('elder') === null && fragmentFor('baabara') === null && fragmentFor('mountKeeper') === null,
  'quest-giver NPCs own no fragment (no single exposition source)');

// --- fragment dialogue is well-formed and renders ----------------------------
for (const [npc, frag] of Object.entries(NPC_FRAGMENTS)) {
  const lines = DIALOGUE[frag.dialogue];
  const ok = Array.isArray(lines) && lines.length > 0 && lines.every((l) => Array.isArray(l) && typeof l[1] === 'string');
  check(ok, `${npc}: ${frag.dialogue} is a well-formed [speaker, text] beat`);
  const d = new Dialogue();
  d.start(lines);
  let renders = true;
  while (d.active) { const c = d.current; if (!c || typeof c.text !== 'string' || c.text.trim().length < 2) renders = false; d.advance(); }
  check(renders, `${npc}: fragment renders real text`);
}

// --- 3. intentional contradiction (place vs incorrect), left unresolved -----
const placeText = textOf('frag_place');
const incorrectText = textOf('frag_incorrect');
check(/assumed it was the wind/i.test(placeText), 'place fragment credits the wind (never Baa)');
check(/do not let anyone tell you it was the wind/i.test(incorrectText),
  'incorrect fragment contradicts the place fragment');
check(!/\byou'?re right\b|\bi was wrong\b|\bit was the wind\b/i.test(incorrectText.replace(/do not let anyone tell you it was the wind/i, '')),
  'incorrect fragment never self-corrects to the true version');

// --- 4. twin foreshadowing stays light and unconfirming ----------------------
const fragmentText = Object.values(NPC_FRAGMENTS).map((f) => textOf(f.dialogue)).join(' ');
const encounterText = textOf('baa_encounter');
const memoryText = ['memory_bell', 'memory_toy', 'memory_ribbon', 'memory_photo'].map(textOf).join(' ');
const combined = `${fragmentText} ${memoryText} ${encounterText}`;
const twinTerms = /\btwin\b|another black sheep|two of you|one of two|\bbrother\b|\bsister\b|\bsibling\b|grandchildren/i;
check(!twinTerms.test(combined), 'no twin confirmation anywhere in fragments/memories/encounter');
check(/one shape look like two/i.test(fragmentText) && /probably just the light/i.test(fragmentText),
  'the one faint silhouette clue is isolated and innocently explained');

// --- 12. the grandchild line appears only at the recognition point -----------
const authoredWithGrandchild = Object.keys(DIALOGUE).filter((k) => /grandchild/i.test(textOf(k)));
check(authoredWithGrandchild.length === 1 && authoredWithGrandchild[0] === 'baa_encounter',
  `"grandchild" appears only in baa_encounter (found: ${authoredWithGrandchild.join(',') || 'none'})`);
check(!/grandchildren/i.test(encounterText), 'the encounter does not reveal the twin (plural)');

// --- 5/6. fragments advance the stage through advanceStory, monotonically ----
const g = game();
g.mode = 'play';
check(fragmentCount(g) === 0 && storyStage(g) === 0, 'fresh run: no fragments, stage 0');
// Talk to a real fragment NPC (Rock Sheep) and confirm the line is woven in once.
g.world.setArea('village');
const rock = g.world.npcs.find((n) => n.id === 'rockSheep');
g.player.x = rock.px + 20 - 34; g.player.y = rock.py + 20 + 2;
g.advance = true; g.update(1 / 60);
check(g.dialogue.active, 'talk to a fragment NPC opens dialogue');
const firstLen = g.dialogue.lines.length;
finishDialogue(g);
check(hasFragment(g, 'frag_object') && fragmentCount(g) === 1, 'fragment recorded once on first talk');
check(storyStage(g) === 2, 'first fragment -> STAGE_2_FRAGMENTS');
g.advance = true; g.update(1 / 60);
check(g.dialogue.active && g.dialogue.lines.length === firstLen - DIALOGUE.frag_object.length,
  'the fragment is not repeated on the next talk');
finishDialogue(g);
check(fragmentCount(g) === 1, 're-talking records no duplicate fragment');

// --- 10/11/13/16. the encounter is reachable, local-only, recognition-only --
const e = game();
e.mode = 'play';
e.world.setArea('shrine');
e.player.x = 12 * TILE + 7; e.player.y = 7 * TILE + 5;
e.q.memories = e.q.required;             // 5/5 — the only requirement
e.q.story.stage = 4;
e.q.sealAnnounced = true;                // as in real play (5th Memory announced the seal)
e.q.story.choices.memory = 'move_on';    // Phase 6 review: keep this focused on the encounter
e.advance = true; e.update(1 / 60);
check(e.dialogue.active, 'altar encounter opens at 5/5');
const enc = textOf('baa_encounter');
check(e.dialogue.lines.some((l) => /WHO ARE YOU\?/.test(l[1] || '')), 'the live altar dialogue begins the encounter');
check(/WHO ARE YOU\?/.test(enc) && /You came back/.test(enc) && /your wool/.test(enc),
  'recognition beats are present (WHO ARE YOU? -> You came back -> your wool)');
check(/My grandchild/.test(enc), 'family relationship becomes clear at recognition');
check(!twinTerms.test(enc), 'encounter reveals no twin details');
check(!/second shape|dark wool/i.test(enc), 'recognition beat carries no twin evidence (that is the separate reveal)');
check(e.others.size === 0, 'encounter needs no remote players (single-player)');
finishDialogue(e);
check(e.mode === 'ending', 'encounter reaches the provisional end state');

// --- 8. no future-stage fact leaks through the AI context -------------------
const gate = game();
gate.q.story.stage = 2;
const earlyCtx = buildContext('elder', gate);
check(earlyCtx.baaStage === 2 && !earlyCtx.knownFacts.some((f) => f.stage > 2),
  'AI context at stage 2 exposes no fact above stage 2');
let leaks = 0;
for (const f of buildContext('elder', gate).knownFacts) if (/grandchild/i.test(f.text)) leaks++;
check(leaks === 0, 'no grandchildren fact before its stage');

// --- 9. AI cannot see the authored fragments (state owns the truth) ---------
const exposed = JSON.stringify(buildContext('elder', gate));
check(!/carved bird|falling down|stopped feeling see-through|lie sheep tell/i.test(exposed),
  'authored fragment text is not exposed through the AI context');

console.log(fail === 0 ? '\nFRAGMENTS + ENCOUNTER PASS' : `\nFRAGMENTS + ENCOUNTER FAIL (${fail})`);
process.exit(fail === 0 ? 0 : 1);