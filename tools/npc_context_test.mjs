// Headless test for the NPC context boundary (Phase 1) and dialogue service (Phase 0).
// No framework: plain assertions, non-zero exit on failure.
import { buildContext, baaStage, emotionalState } from '../src/systems/npc_context.js';
import { PERSONAS, NPC_KNOWLEDGE } from '../src/data/npc_personas.js';
import { createQuestState } from '../src/systems/quests.js';
import { createNPCDialogueService, FALLBACK_LINE } from '../src/systems/npc_dialogue.js';

let fail = 0;
const check = (cond, msg) => {
  console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg);
  if (!cond) fail++;
};

// Minimal game shape: buildContext only reads q, world.def.name and mode.
const makeGame = (memories, mode = 'play') => {
  const q = createQuestState();
  q.memories = memories;
  return { q, mode, world: { def: { name: 'Sheep Village' } } };
};

const factsOf = (ctx) => ctx.knownFacts.map((f) => f.text);
const hasGrandchildren = (ctx) => factsOf(ctx).some((t) => /grandchild/i.test(t));

// --- Baa lore stage derivation ---------------------------------------------
check(baaStage(makeGame(0)) === 0, 'baaStage: 0 memories -> stage 0');
check(baaStage(makeGame(1)) === 1, 'baaStage: 1 memory -> stage 1');
check(baaStage(makeGame(3)) === 3, 'baaStage: 3 memories -> stage 3');
check(baaStage(makeGame(5)) === 4, 'baaStage: 5 memories -> stage 4 (reveal still pending)');
check(baaStage(makeGame(5, 'ending')) === 5, 'baaStage: ending -> stage 5 (lineage revealed)');
check(baaStage(null) === 0, 'baaStage: no game -> stage 0');

// --- Emotional state derivation --------------------------------------------
check(emotionalState(makeGame(0)) === 'playful', 'emotionalState: early -> playful');
check(emotionalState(makeGame(2)) === 'strange', 'emotionalState: middle -> strange');
check(emotionalState(makeGame(5)) === 'quiet', 'emotionalState: late -> quiet');
check(emotionalState(makeGame(5, 'ending')) === 'peaceful', 'emotionalState: resolution -> peaceful');

// --- Hard fact gating (early) ----------------------------------------------
const early = buildContext('elder', makeGame(0));
check(!hasGrandchildren(early), 'early: grandchildren revelation absent');
check(early.baaStage === 0, 'early: baaStage is 0');
check(early.emotionalState === 'playful', 'early: emotionalState is playful');
check(early.knownFacts.length > 0, 'early: elder still knows stage-0 facts');
check(!('q' in early), 'early: raw game state (q) is not exposed');

const oneMemory = buildContext('elder', makeGame(1));
check(!hasGrandchildren(oneMemory), 'stage 1: grandchildren revelation still absent');
check(oneMemory.baaStage === 1, 'stage 1: baaStage is 1');

// --- Appropriate fact becomes available later ------------------------------
const late = buildContext('elder', makeGame(5));
check(!hasGrandchildren(late), 'late (5 memories): grandchildren still gated out');
check(factsOf(late).some((t) => /familiar about the two of you/i.test(t)),
  'late: stage-4 family-clue fact is now present');
check(late.baaStage === 4, 'late: baaStage is 4');

const resolved = buildContext('elder', makeGame(5, 'ending'));
check(hasGrandchildren(resolved), 'resolution: grandchildren revelation is now present');
check(resolved.baaStage === 5, 'resolution: baaStage is 5');
check(resolved.emotionalState === 'peaceful', 'resolution: emotionalState is peaceful');

// --- Gating invariant across every stage and persona -----------------------
let violations = 0;
for (let m = 0; m <= 5; m++) {
  const g = makeGame(m, m === 5 ? 'ending' : 'play');
  const stage = baaStage(g);
  for (const id of Object.keys(PERSONAS)) {
    for (const f of buildContext(id, g).knownFacts) {
      if (f.stage > stage) violations++;
    }
  }
}
check(violations === 0, 'invariant: no fact above its stage appears in any context');

// --- NPC knowledge stays limited to the NPC --------------------------------
const keeper = buildContext('mountKeeper', makeGame(5, 'ending'));
check(!hasGrandchildren(keeper), 'mount keeper never receives the grandchildren fact');
check(NPC_KNOWLEDGE.mountKeeper.every((f) => !/grandchild/i.test(f.text)),
  'mount keeper knowledge table has no grandchildren line');

// --- Boundary shape: constrained, frozen, primitives only ------------------
const ctx = buildContext('elder', makeGame(2), 'WHO_IS_BAA', 'Who is Baa?');
check(ctx.intent === 'WHO_IS_BAA', 'context: intent passthrough');
check(ctx.playerLine === 'Who is Baa?', 'context: playerLine passthrough');
check(ctx.location === 'Sheep Village', 'context: location is the area name');
check(ctx.memoryCount.have === 2 && ctx.memoryCount.required === 5, 'context: memoryCount');
check(Object.isFrozen(ctx) && Object.isFrozen(ctx.knownFacts), 'context: frozen (provider cannot mutate)');
const json = JSON.stringify(ctx);
check(!/roomCode|others|netTimer|myId|secretPoke|"q":/.test(json), 'context: no raw game internals serialize');
check(buildContext('nobody', makeGame(0)).npc.id === 'unknown', 'unknown npc -> default persona (total)');

// --- Phase 0: dialogue service ---------------------------------------------
const svc = createNPCDialogueService();
await svc.initialize();
check(svc.isAvailable() === true, 'service: available after initialize');
check(svc.providerName === 'scripted', 'service: selects the scripted provider');

const generated = await svc.generate(ctx);
check(typeof generated === 'string' && generated.length > 0, 'service: generate returns a line');
check(!hasGrandchildren(buildContext('elder', makeGame(0))) && (await svc.generate({ intent: 'WHO_IS_BAA' })).length > 0,
  'service: generate works with intent only');

const overridden = await svc.generate({ scriptedAnswer: 'custom line' });
check(overridden === 'custom line', 'service: caller-supplied scriptedAnswer wins');
check((await svc.generate({})) === FALLBACK_LINE, 'service: no intent -> safe fallback line');

// Service must survive a throwing local provider without breaking gameplay.
const svc2 = createNPCDialogueService({
  localFactory: () => ({
    name: 'boom', status: 'ready', importOk: true, progress: 1,
    isAvailable: () => true,
    async initialize() {},
    async generate() { throw new Error('x'); },
  }),
});
await svc2.initialize();
await svc2.ready();
const boomOut = await svc2.generate(ctx);
check(typeof boomOut === 'string' && boomOut.length > 0, 'service: throwing provider falls back safely');

console.log(fail === 0 ? '\nNPC CONTEXT PASS' : `\nNPC CONTEXT FAIL (${fail})`);
process.exit(fail === 0 ? 0 : 1);
