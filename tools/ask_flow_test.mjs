// Headless test for the Phase 2 guided conversation: intent availability,
// the context→service→answer pipeline, state safety, repeat questions and exit.
// Drives a real Game with stubbed canvas/window, same stubs as tools/smoke.mjs.
import { Game } from '../src/game.js';
import { TILE } from '../src/data/world.js';
import { talkFor } from '../src/systems/quests.js';
import { npcDialogue } from '../src/systems/npc_dialogue.js';
import { PERSONAS, INTENT_LABELS } from '../src/data/npc_personas.js';
import { selectAnswer } from '../src/data/npc_answers.js';

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

let fail = 0;
const check = (cond, msg) => {
  console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg);
  if (!cond) fail++;
};

await npcDialogue.initialize();

const g = new Game(ctx);
g.mode = 'play';

// --- 1/2. Supported intents per NPC; unsupported ones never appear ----------
g.openGuided('elder', 'Elder Sheep');
check(g.ask.active && g.ask.intents.length === 5, 'elder: offers all five intents');
check(g.ask.intents.every((i) => INTENT_LABELS[i]), 'elder: every shown intent is labeled');

g.openGuided('mountKeeper', 'Mount Keeper');
check(g.ask.intents.length === 3, 'mount keeper: offers a subset (3)');
check(!g.ask.intents.includes('WHO_IS_BAA'), 'mount keeper: does not offer "Who is Baa?"');
check(!g.ask.intents.includes('WHAT_DO_YOU_REMEMBER'), 'mount keeper: does not offer "What do you remember?"');
check(g.ask.intents.every((i) => PERSONAS.mountKeeper.supportedIntents.includes(i)),
  'mount keeper: shown intents come from the persona');

g.openGuided('baabara', 'Baaabara');
check(g.ask.intents.includes('WHAT_DO_YOU_REMEMBER') && !g.ask.intents.includes('WHY_TWO_BLACK_SHEEP'),
  'baabara: own subset (remember yes, two-sheep no)');

g.closeAsk();
g.openGuided('lonely', 'Lonely Sheep');
check(g.ask.active === false, 'NPC without a persona gets no chooser');

// --- 3/4. Intent flows through buildContext -> service -> answer ------------
g.closeAsk();
g.openGuided('elder', 'Elder Sheep');
g.ask.index = 0; // WHO_IS_BAA
let captured = null;
const origGenerate = npcDialogue.generate;
npcDialogue.generate = async (c) => { captured = c; return origGenerate.call(npcDialogue, c); };
await g.askQuestion();
npcDialogue.generate = origGenerate;
check(captured && captured.intent === 'WHO_IS_BAA' && captured.npc.id === 'elder',
  'selected intent reaches buildContext -> NPCDialogueService.generate');
check(typeof g.ask.answer === 'string' && g.ask.answer.length > 0, 'scripted provider returns an answer');
check(!('q' in captured) && !('player' in captured) && !('world' in captured),
  'service receives the constrained context, not raw game state');
check(npcDialogue.providerName === 'scripted', 'provider is scripted (no AI)');

// --- 5. Asking questions mutates no game state ------------------------------
g.closeAsk();
g.openGuided('elder', 'Elder Sheep');
const before = JSON.stringify(g.q);
for (let i = 0; i < g.ask.intents.length; i++) { g.ask.index = i; await g.askQuestion(); }
check(JSON.stringify(g.q) === before, 'asking every question mutates no game state');
check(g.q.memories === 0, 'Memories not advanced by asking "Who is Baa?"');

// --- 11. Multiple questions, then leave (state unchanged) -------------------
g.ask.index = 0; await g.askQuestion(); const a1 = g.ask.answer;
g.ask.index = 1; await g.askQuestion(); const a2 = g.ask.answer;
check(g.ask.active, 'chooser stays open for another question');
check(a1 && a2 && a1 !== a2, 'different intents return different answers');
const beforeClose = JSON.stringify(g.q);
g.closeAsk();
check(!g.ask.active && JSON.stringify(g.q) === beforeClose, 'leaving the chooser changes no state');

// --- 6/7. Gating: early vs later stage, per NPC -----------------------------
let leaks = 0;
for (const id of Object.keys(PERSONAS)) {
  for (const intent of PERSONAS[id].supportedIntents) {
    const t = selectAnswer(id, intent, 4);
    if (t && /grandchild/i.test(t)) leaks++;
  }
}
check(leaks === 0, 'stage <= 4: no scripted answer reveals the grandchildren');
check(/grandchild/i.test(selectAnswer('elder', 'WHY_TWO_BLACK_SHEEP', 5) || ''),
  'stage 5: elder may reveal the grandchildren');
check(!/grandchild/i.test(selectAnswer('mountKeeper', 'WHY_TWO_BLACK_SHEEP', 5) || ''),
  'stage 5: mount keeper still does not reveal it');
check(selectAnswer('elder', 'WHO_IS_BAA', 2) !== selectAnswer('mountKeeper', 'TELL_ME_ABOUT_THIS_PLACE', 2),
  'answers are NPC-specific, not shared boilerplate');

// --- 8/9/10. Real interaction: opening dialogue -> chooser -> repeat -> exit -
const g2 = new Game(ctx);
g2.mode = 'play';
g2.world.setArea('village');
g2.player.x = 14 * TILE - 34;
g2.player.y = 9 * TILE + 2;   // within talk range of the Elder
g2.advance = true; g2.update(1 / 60);
check(g2.dialogue.active && g2.dialogue.lines[0][0] === 'Elder Sheep',
  'existing authored opening dialogue still opens (talkFor authoritative)');

let guard = 0;
while (g2.dialogue.active && guard < 30) { g2.advance = true; g2.update(1 / 60); guard++; }
check(g2.ask.active && g2.ask.npcId === 'elder', 'after opening, guided chooser appears');

// Modal: movement is frozen while the chooser is open.
const xBefore = g2.player.x;
g2.keys['KeyD'] = true;
g2.update(1 / 60);
check(g2.player.x === xBefore, 'chooser is modal: player does not wander');

// Repeat question in the same interaction.
await g2.askQuestion();
check(g2.ask.active && typeof g2.ask.answer === 'string', 'a second interaction can ask a question');

g2.closeAsk();
check(!g2.ask.active, 'player can leave the chooser');

check(typeof talkFor('elder', { memories: 0, required: 5, secret: {} })[0][0] === 'string',
  'talkFor still returns authored dialogue (unchanged)');

console.log(fail === 0 ? '\nASK FLOW PASS' : `\nASK FLOW FAIL (${fail})`);
process.exit(fail === 0 ? 0 : 1);
