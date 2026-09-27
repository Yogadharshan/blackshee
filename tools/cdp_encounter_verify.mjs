// One real Chromium: drive the Phase 3 fragment delivery and the Phase 4
// Forgotten Baa encounter through real keydown events.
// Usage: node tools/cdp_encounter_verify.mjs
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

const BASE = process.env.BASE || 'http://127.0.0.1:8080';
const PORT = 9339;
const url = `${BASE}/?play=1`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const procs = [];

function launch() {
  const p = spawn('chromium-browser', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=/tmp/opencode/cdp-enc-' + Date.now(),
    url,
  ], { stdio: 'ignore' });
  procs.push(p);
}

async function pageTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const j = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = j.find((t) => t.type === 'page' && t.url.includes(new URL(BASE).host));
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('chromium CDP never came up');
}

const ws = { conn: null };
function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const c = new WebSocket(wsUrl);
    c.on('open', () => resolve(c));
    c.on('error', reject);
  });
}
function send(c, method, params) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1e9);
    const onMsg = (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.id !== id) return;
      c.off('message', onMsg);
      if (m.error) return reject(new Error(m.error.message));
      resolve(m.result);
    };
    c.on('message', onMsg);
    c.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { c.off('message', onMsg); reject(new Error('cdp timeout')); }, 8000);
  });
}
async function evalIn(expr) {
  const r = await send(ws.conn, 'Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result ? r.result.value : undefined;
}
async function press(code, key) {
  await evalIn(`window.dispatchEvent(new KeyboardEvent('keydown',{code:${JSON.stringify(code)},key:${JSON.stringify(key)}})); true`);
  await sleep(110);
  await evalIn(`window.dispatchEvent(new KeyboardEvent('keyup',{code:${JSON.stringify(code)},key:${JSON.stringify(key)}})); true`);
  await sleep(50);
}
// Advance an open dialogue with real E presses until it closes.
async function runDialogue(max = 30) {
  for (let i = 0; i < max; i++) {
    const active = await evalIn(`window.__game.dialogue.active`);
    if (!active) return;
    await press('KeyE', 'e');
  }
}

let fail = 0;
const check = (cond, msg) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg); if (!cond) fail++; };

try {
  launch();
  connect(await pageTarget()).then((c) => { ws.conn = c; });
  for (let i = 0; i < 40 && !ws.conn; i++) await sleep(200);
  await sleep(1500);

  // --- Phase 3: an NPC fragment is heard once, through real input -----------
  await evalIn(`(() => {
    const g = window.__game;
    g.mode = 'play';
    g.world.setArea('village');
    const r = g.world.npcs.find((n) => n.id === 'rockSheep');
    g.player.x = r.px + 20 - 34; g.player.y = r.py + 20 + 2;
    g.closeAsk();
    return true;
  })()`);
  await press('KeyE', 'e');
  const fragShown = await evalIn(`window.__game.dialogue.active && window.__game.dialogue.lines.some((l) => /carved bird/i.test(l[1] || ''))`);
  check(fragShown === true, 'real keydown: the Rock Sheep fragment is woven into the talk');
  await runDialogue();
  check((await evalIn(`!!(window.__game.q.story.fragments && window.__game.q.story.fragments.frag_object)`)) === true,
    'the fragment was recorded in story state');
  check((await evalIn(`window.__game.q.story.stage`)) >= 2, 'hearing a fragment raised the narrative stage');

  // --- Phase 4: the Forgotten Baa encounter at 5/5 --------------------------
  await evalIn(`(() => {
    const g = window.__game;
    g.world.setArea('shrine');
    g.player.x = 12 * 40 + 7; g.player.y = 7 * 40 + 5;
    g.q.memories = g.q.required;
    g.q.story.stage = 4;
    g.q.sealAnnounced = true;
    // Phase 6 review: pre-answer the Photograph choice so this check stays
    // focused on the Phase 4/5 encounter + reveal (Phase 6 has its own verify).
    g.q.story.choices.memory = 'move_on';
    g.closeAsk();
    return true;
  })()`);
  await press('KeyE', 'e');
  check((await evalIn(`window.__game.dialogue.active`)) === true, 'altar opens the encounter at 5/5');
  check((await evalIn(`window.__game.stageBaa`)) === true, 'the Baa sequence is staged in the browser');
  check((await evalIn(`window.__game.baaRevealAt >= 0`)) === true, 'the reveal index is armed');
  const encText = await evalIn(`window.__game.dialogue.lines.map((l) => l[1]).join(' ')`);
  check(/WHO ARE YOU\?/.test(encText) && /You came back/.test(encText) && /My grandchild/.test(encText),
    'recognition beats reached in the real browser');
  check(!/grandchildren|\btwin\b/i.test(encText), 'encounter leaks no twin detail');
  await runDialogue(40);
  check((await evalIn(`window.__game.stageBaa`)) === false, 'staging cleared after the sequence');
  check((await evalIn(`window.__game.mode`)) === 'ending', 'encounter reaches the provisional end state');
  check((await evalIn(`window.__game.q.story.twinRevealed`)) === true, 'the quiet aftermath set TWIN_REVEALED');
  check((await evalIn(`window.__game.q.story.stage`)) === 5, 'the reveal raised the stage to 5 (narrative only)');
  check((await evalIn(`window.__game.others.size`)) === 0, 'no second player / multiplayer activation after the reveal');

  console.log(fail === 0 ? '\nCDP ENCOUNTER PASS' : `\nCDP ENCOUNTER FAIL (${fail})`);
  process.exitCode = fail === 0 ? 0 : 1;
} catch (err) {
  console.error('VERIFY ERROR:', err.message);
  process.exitCode = 1;
} finally {
  for (const p of procs) { try { p.kill('SIGKILL'); } catch {} }
}