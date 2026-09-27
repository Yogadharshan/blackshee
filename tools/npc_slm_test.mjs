// Headless tests for Phase 3: provider selection, permanent fallback, the
// context boundary, output sanitizing, and the state-safety guarantee.
// No real model/inference and no network — the local provider is faked.
import { createNPCDialogueService, ScriptedDialogueProvider, FALLBACK_LINE, LOCAL_SLM_NPCS } from '../src/systems/npc_dialogue.js';
import { buildContext } from '../src/systems/npc_context.js';
import { selectAnswer } from '../src/data/npc_answers.js';
import { createQuestState } from '../src/systems/quests.js';
import {
  sanitizeReply, buildMessages, extractText, detectWebGPU,
  createProgress, applyProgress, formatProgress, displayProgress,
  pickModelHost, pickLocalModel, LOCAL_MODEL_PATH,
  MAX_REPLY_CHARS, INFER_TIMEOUT_MS, IMPORT_TIMEOUT_MS, LOAD_STALL_MS,
} from '../src/systems/npc_slm.js';

let fail = 0;
const check = (cond, msg) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg); if (!cond) fail++; };

const makeGame = (memories = 0, mode = 'play') => {
  const q = createQuestState();
  q.memories = memories;
  return { q, mode, world: { def: { name: 'Sheep Village' } } };
};
const elderCtx = (m = 0, intent = 'WHO_IS_BAA') => buildContext('elder', makeGame(m), intent);

// A stand-in local provider; override any member per test.
const fakeLocal = (over = {}) => ({
  name: 'local-slm',
  status: 'ready',
  importOk: true,
  error: null,
  progress: 1,
  inferences: 0,
  timings: { initMs: 1, firstInferenceMs: null, lastInferenceMs: null },
  isAvailable() { return this.status === 'ready'; },
  async initialize() {},
  async generate() { return 'LOCAL'; },
  ...over,
});

// --- 1. No WebGPU -> scripted provider --------------------------------------
const real = createNPCDialogueService();
await real.initialize();
await real.ready();
check(detectWebGPU() === false, 'node: detectWebGPU is false (no WebGPU)');
check(real.status === 'unavailable' && real.providerName === 'scripted', 'no WebGPU -> scripted provider selected');
check(typeof (await real.generate(elderCtx())) === 'string', 'scripted path still answers without WebGPU');

// --- 2. Transformers.js import failure -> scripted --------------------------
const s2 = createNPCDialogueService({ localFactory: () => fakeLocal({ status: 'failed', importOk: false, error: 'import failed', isAvailable: () => false }) });
await s2.initialize(); await s2.ready();
check(s2.status === 'failed' && s2.providerName === 'scripted', 'import failure -> scripted selected');
check((await s2.generate(elderCtx())) === selectAnswer('elder', 'WHO_IS_BAA', 0), 'import failure -> scripted answer');
check(s2.debug().importOk === false && /import failed/.test(s2.debug().lastError || ''), 'debug reports the import failure');

// --- 3. Model initialization failure -> scripted ----------------------------
let initThrew = false;
const s3 = createNPCDialogueService({ localFactory: () => fakeLocal({
  status: 'unavailable', isAvailable: () => false,
  async initialize() { initThrew = true; throw new Error('init boom'); },
}) });
await s3.initialize(); await s3.ready();
check(initThrew && s3.providerName === 'scripted', 'throwing initialize -> scripted selected');
check((await s3.generate(elderCtx())) === selectAnswer('elder', 'WHO_IS_BAA', 0), 'init failure -> scripted answer');

// --- 4. Inference failure -> scripted ---------------------------------------
const s4 = createNPCDialogueService({ localFactory: () => fakeLocal({ async generate() { return null; } }) });
await s4.initialize(); await s4.ready();
check((await s4.generate(elderCtx())) === selectAnswer('elder', 'WHO_IS_BAA', 0), 'null inference -> scripted answer');
const s4b = createNPCDialogueService({ localFactory: () => fakeLocal({ async generate() { throw new Error('infer'); } }) });
await s4b.initialize(); await s4b.ready();
check((await s4b.generate(elderCtx())) === selectAnswer('elder', 'WHO_IS_BAA', 0), 'throwing inference -> scripted answer');

// --- 5. Output validation ----------------------------------------------------
check(sanitizeReply('  "Baa? I do not remember."  ') === 'Baa? I do not remember.', 'sanitize: trims + strips quotes');
check(sanitizeReply('') === null && sanitizeReply('   ') === null && sanitizeReply('...') === null, 'sanitize: rejects empty/malformed');
check(sanitizeReply('RULES: just be nice') === null, 'sanitize: rejects prompt leakage');
check(sanitizeReply('As an AI language model, I cannot help.') === null, 'sanitize: rejects assistant-speak');
const long = "Here is a lot of text. It keeps going. And going. And going some more. Finally it stops.";
const clamped = sanitizeReply(long);
check(clamped.split(/[.!?]/).filter((s) => s.trim()).length <= 3, 'sanitize: clamps to <= 3 sentences');
check(sanitizeReply('x'.repeat(MAX_REPLY_CHARS + 200)).length <= MAX_REPLY_CHARS, 'sanitize: clamps to max chars');
check(sanitizeReply('Baa? That name should mean something to me.') === 'Baa? That name should mean something to me.', 'sanitize: keeps a good line intact');

check(extractText([{ generated_text: [{ role: 'user', content: 'x' }, { role: 'assistant', content: 'hello' }] }]) === 'hello', 'extractText: assistant message');
check(extractText([{ generated_text: 'plain' }]) === 'plain', 'extractText: plain string');
check(extractText(null) === null, 'extractText: null-safe');

// --- prompt is built only from constrained context --------------------------
const msgs = buildMessages(elderCtx(2, 'WHO_IS_BAA'));
check(msgs[0].role === 'system' && msgs[1].role === 'user', 'prompt: system + user messages');
const flat = msgs.map((m) => m.content).join('\n');
check(/KNOWN FACTS/.test(flat) && /RULES/.test(flat) && /PERSONALITY/.test(flat), 'prompt: has facts/personality/rules');
check(!/baaStage|grandchild|stage 5/i.test(flat), 'prompt: no raw stage internals or early lineage');

// --- 6. Successful selection when local SLM is available --------------------
const s6 = createNPCDialogueService({ localFactory: () => fakeLocal() });
await s6.initialize(); await s6.ready();
check(s6.status === 'ready' && s6.providerName === 'local-slm', 'local available -> local provider selected');
check((await s6.generate(elderCtx())) === 'LOCAL', 'eligible NPC (elder) uses the local provider');
const keeperAns = await s6.generate(buildContext('mountKeeper', makeGame(2), 'TELL_ME_ABOUT_THIS_PLACE'));
check(keeperAns !== 'LOCAL' && typeof keeperAns === 'string', 'non-eligible NPC stays on scripted');

// --- 7. Provider selection happens once -------------------------------------
let factoryCalls = 0;
const s7 = createNPCDialogueService({ localFactory: () => { factoryCalls++; return fakeLocal(); } });
await s7.initialize(); await s7.ready();
await s7.generate(elderCtx(0));
await s7.generate(elderCtx(1));
await s7.generate(buildContext('mountKeeper', makeGame(1), 'WHY_TWO_BLACK_SHEEP'));
await s7.ready();
check(factoryCalls === 1, 'local provider attempted exactly once per session');
check(LOCAL_SLM_NPCS.length === 1 && LOCAL_SLM_NPCS[0] === 'elder', 'vertical slice: only Elder is eligible');

// --- 8. Provider receives no raw game state ---------------------------------
let seen = null;
const s8 = createNPCDialogueService({ localFactory: () => fakeLocal({ async generate(c) { seen = c; return 'ok'; } }) });
await s8.initialize(); await s8.ready();
await s8.generate(buildContext('elder', makeGame(3), 'WHAT_DO_YOU_REMEMBER'));
check(seen && !('q' in seen) && !('world' in seen) && !('player' in seen), 'provider receives constrained context only');
check(Object.isFrozen(seen), 'provider context is frozen');

// --- 9. Provider cannot mutate game state through its interface -------------
const s9 = createNPCDialogueService({ localFactory: () => fakeLocal({ async generate(c) { c.baaStage = 99; return 'hacked'; } }) });
await s9.initialize(); await s9.ready();
const g9 = makeGame(1);
g9.q.story.stage = 1;
const ctx9 = buildContext('elder', g9, 'WHO_IS_BAA');
const r9 = await s9.generate(ctx9);
check(typeof r9 === 'string' && r9 !== 'hacked', 'a mutating provider is rejected -> scripted fallback');
check(ctx9.baaStage === 1 && g9.q.memories === 1, 'game state untouched by the provider');

// --- 10. Scripted provider still works --------------------------------------
const sp = new ScriptedDialogueProvider();
await sp.initialize();
check(sp.isAvailable() === true, 'scripted provider is always available');
check(typeof (await sp.generate(elderCtx())) === 'string', 'scripted provider returns a line');
check((await sp.generate({})) === FALLBACK_LINE, 'scripted provider safe fallback line');

// --- limits sanity -----------------------------------------------------------
check(INFER_TIMEOUT_MS > 0 && INFER_TIMEOUT_MS <= 15000, `inference timeout is conservative (${INFER_TIMEOUT_MS}ms)`);

// --- download progress aggregation ------------------------------------------
const pr = createProgress();
check(pr.ratio === 0, 'progress: starts at 0');
applyProgress(pr, { status: 'download', file: 'onnx/model_q4.onnx', loaded: 0, total: 400 * 1048576 });
applyProgress(pr, { status: 'progress', file: 'onnx/model_q4.onnx', loaded: 200 * 1048576, total: 400 * 1048576 });
check(pr.ratio > 0.49 && pr.ratio <= 0.5, 'progress: ratio tracks loaded/total (not stuck at 0)');
check(/model_q4\.onnx/.test(formatProgress(pr)) && /MB/.test(formatProgress(pr)), 'progress: label shows file + MB');
applyProgress(pr, { status: 'progress', file: 'tokenizer.json', loaded: 50 * 1048576, total: 50 * 1048576 });
check(pr.ratio > 0.5, 'progress: aggregates across multiple files');
check(formatProgress(pr).length < 80, 'progress: label stays short');
check(LOAD_STALL_MS > 0 && LOAD_STALL_MS <= 60000, `stall timeout is sane (${LOAD_STALL_MS}ms)`);
check(IMPORT_TIMEOUT_MS > 0 && IMPORT_TIMEOUT_MS <= 60000, `import timeout is sane (${IMPORT_TIMEOUT_MS}ms)`);
check(displayProgress(1) === 0.99 && displayProgress(0.5) === 0.5 && displayProgress(0) === 0,
  'progress: capped below 100% while loading');

// --- restricted-network / self-host overrides -------------------------------
check(pickModelHost('?hfhost=https://mirror.example/', null) === 'https://mirror.example', 'host override from ?hfhost');
check(pickModelHost('', 'https://g.example/') === 'https://g.example', 'host override from window.__hfHost');
check(pickModelHost('', null) === null, 'host defaults to the official HF host');
check(pickLocalModel('?localmodel=1', false) === true, 'local model via ?localmodel=1');
check(pickLocalModel('', true) === true, 'local model via window.__localModel');
check(pickLocalModel('', false) === false, 'remote models are the default');
check(LOCAL_MODEL_PATH === '/models/', 'local weights are served same-origin under /models/');

// --- provider is visible (progress readable) while still loading ------------
let release;
const gate = new Promise((r) => { release = r; });
const slow = fakeLocal({
  status: 'loading',
  isAvailable() { return this.status === 'ready'; },
  async initialize() { this.status = 'loading'; await gate; this.status = 'ready'; },
});
const sLoad = createNPCDialogueService({ localFactory: () => slow });
await sLoad.initialize();
check(sLoad.local === slow && sLoad.status === 'loading', 'service exposes the local provider while it loads');
release();
await sLoad.ready();
check(sLoad.status === 'ready' && sLoad.providerName === 'local-slm', 'loading provider becomes active when ready');

console.log(fail === 0 ? '\nNPC SLM PASS' : `\nNPC SLM FAIL (${fail})`);
process.exit(fail === 0 ? 0 : 1);
