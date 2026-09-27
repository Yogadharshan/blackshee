// Input/dialogue regression tests (handout: E reliability + shrine lock + no
// stuck state). Drives the real keydown/keyup handlers through window events so
// the exact input path is exercised (state transitions, not dialogue prose).
import { Game } from '../src/game.js';

const noop = () => {};
const ctx = new Proxy({}, {
  get: (t, k) => {
    if (k === 'measureText') return (s) => ({ width: String(s).length * 8 });
    if (k === 'canvas') return { width: 960, height: 640 };
    return noop;
  },
  set: () => true,
});
const listeners = {};
globalThis.window = {
  addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
};
globalThis.localStorage = undefined;

let g;
const mk = () => {
  g = new Game(ctx);
  g.mode = 'play';
  g.closeAsk();
};
const kd = (code, key = '', repeat = false) => {
  for (const fn of listeners.keydown || []) fn({ code, key: key || code, repeat, preventDefault: noop });
};
const ku = (code) => { for (const fn of listeners.keyup || []) fn({ code }); };
const blur = () => { for (const fn of listeners.blur || []) fn(); };
const step = (n = 1) => { for (let i = 0; i < n; i++) g.update(1 / 60); };
const teleport = (area, x, y) => { g.world.setArea(area); g.player.x = x * 40 + 7; g.player.y = y * 40 + 2; };
let fail = 0;
const check = (c, m) => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + m); if (!c) fail++; };
const tap = (code, key) => { kd(code, key); ku(code); step(1); };
const mashE = (max = 40) => {
  let n = 0;
  while (g.dialogue.active && n < max) { tap('KeyE', 'e'); n++; }
  return n;
};

// --- 1. unmounted: E opens / advances / closes / recovers --------------------
mk(); teleport('village', 14, 9);
tap('KeyE', 'e');
check(g.dialogue.active, 'unmounted: E opens dialogue');
const i0 = g.dialogue.i;
tap('KeyE', 'e');
check(g.dialogue.i === i0 + 1, 'unmounted: E advances one line');
mashE();
check(!g.dialogue.active, 'unmounted: E closes dialogue');
if (g.ask.active) g.closeAsk();
tap('KeyE', 'e');
check(g.dialogue.active, 'unmounted: a second interaction works (no stuck state)');
mashE(); if (g.ask.active) g.closeAsk();

// --- 2. mounted: same flow, converges ----------------------------------------
mk(); g.mounted = true; g.q.mountOwned = true; teleport('village', 14, 9);
tap('KeyE', 'e');
check(g.dialogue.active, 'mounted: E opens dialogue');
const i1 = g.dialogue.i;
tap('KeyE', 'e');
check(g.dialogue.i === i1 + 1, 'mounted: E advances one line');
mashE();
check(!g.dialogue.active, 'mounted: E closes dialogue');
if (g.ask.active) g.closeAsk();
check(g.mounted === true, 'mounted: stay mounted after dialogue');

// --- 3. Old Shrine lock (altar, <5 memories -> gate_sealed) ------------------
mk(); teleport('shrine', 12, 7);
tap('KeyE', 'e');
check(g.dialogue.active, 'shrine lock: opens dialogue');
mashE();
check(!g.dialogue.active, 'shrine lock: dialogue closes with E');
tap('KeyE', 'e'); step(2);
check(g.dialogue.active, 'shrine lock: can be interacted again (no repeat loop)');
mashE();

// --- 4. missed keyup must not dead-lock E ------------------------------------
mk(); teleport('village', 14, 9);
kd('KeyE', 'e'); step(1);          // hold E, keyup never arrives
check(g.dialogue.active, 'stale: dialogue is open');
ku('KeyE');                        // keyup arrives late
tap('KeyE', 'e');
check(g.dialogue.i > 0, 'stale: a fresh E press advances after the late keyup');
mashE();

// --- 5. ask menu must never block the seal line ------------------------------
mk(); teleport('village', 15, 4);
g.q.flowers = 3; g.q.memories = 4; g.q.sealAnnounced = false;  // hand-in = 5th Memory
tap('KeyE', 'e');                            // hand-in opens
let overlap = false;
let reachedSeal = false;
for (let i = 0; i < 40; i++) {
  if (g.ask.active && g.dialogue.active) { overlap = true; break; }  // the bug
  if (g.dialogue.active && g.q.sealAnnounced) { reachedSeal = true; break; } // stop with seal on screen
  if (!g.dialogue.active) break;
  tap('KeyE', 'e');                          // one line/step at a time
}
check(!overlap, 'ask menu never overlaps an open dialogue');
check(reachedSeal, 'baabara: the seal line appears after the hand-in flow');
check(g.q.collected.flower === true && g.q.sealAnnounced === true,
  'baabara: flower granted and the seal was announced');
check(g.dialogue.active && !g.ask.active, 'baabara: seal is on screen with the ask menu deferred');
tap('KeyE', 'e');
check(!g.dialogue.active && g.ask.active, 'baabara: seal closes with E, then the guided questions open');
g.closeAsk();
tap('KeyE', 'e');
check(g.dialogue.active, 'baabara: interaction works after the seal/ask state');
mashE();

// --- 6. movement is not left stuck by dialogue or blur -----------------------
mk();
kd('KeyW', 'w'); step(2);
ku('KeyW'); step(2);
blur();
check(Object.keys(g.keys).length === 0, 'blur clears held keys (movement cannot stick)');

console.log(fail === 0 ? '\nINPUT FLOW PASS' : `\nINPUT FLOW FAIL (${fail})`);
process.exit(fail === 0 ? 0 : 1);