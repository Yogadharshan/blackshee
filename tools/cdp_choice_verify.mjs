// One real Chromium: exercise the Phase 6 choice UI through real keydown events.
// The Rock Sheep offer choice is picked with a number key; the Photograph choice
// at the altar is picked with a number key; both write q.story.choices only.
// Usage: node tools/cdp_choice_verify.mjs
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
    '--user-data-dir=/tmp/opencode/cdp-choice-' + Date.now(),
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
async function tap(code, key) {
  await evalIn(`window.dispatchEvent(new KeyboardEvent('keydown',{code:${JSON.stringify(code)},key:${JSON.stringify(key)}})); true`);
  await sleep(110);
  await evalIn(`window.dispatchEvent(new KeyboardEvent('keyup',{code:${JSON.stringify(code)},key:${JSON.stringify(key)}})); true`);
  await sleep(60);
}
const press = (code, key) => tap(code, key);
// Advance with real E presses until it closes, or until a choice appears.
async function advanceUntilChoosing(max = 30) {
  for (let i = 0; i < max; i++) {
    if (await evalIn(`window.__game.dialogue.choosing`)) return true;
    if (!(await evalIn(`window.__game.dialogue.active`))) return false;
    await press('KeyE', 'e');
  }
  return await evalIn(`window.__game.dialogue.choosing`);
}
async function runDialogue(max = 40) {
  for (let i = 0; i < max; i++) {
    if (!(await evalIn(`window.__game.dialogue.active`))) return;
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

  // --- Choice 3 (Rock Sheep): offered in the real flow, picked with "2" ------
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
  check((await evalIn(`window.__game.dialogue.active`)) === true, 'rock offer dialogue opens');
  check((await advanceUntilChoosing(20)) === true, 'the authored choice appears after the offer');
  check((await evalIn(`window.__game.dialogue.choice.options.length`)) === 2, 'the choice shows two replies');
  check((await evalIn(`window.__game.q.story.choices.rock || null`)) === null, 'nothing recorded before the pick');
  await press('Digit2', '2');
  check((await evalIn(`window.__game.q.story.choices.rock`)) === 'practical', 'pressing "2" records the practical reply');
  check((await evalIn(`window.__game.dialogue.active && !window.__game.dialogue.choosing`)) === true, 'the consequence plays after the pick');
  check((await evalIn(`window.__game.dialogue.lines.map((l) => l[1]).join(' ')`)).includes('It is a rock'),
    'the consequence is the authored practical line');
  await runDialogue();
  check((await evalIn(`window.__game.q.story.choices.rock`)) === 'practical', 'the choice persists after the flow');

  // --- Choice 4 (Photograph): offered at the altar, picked with "1" ---------
  await evalIn(`(() => {
    const g = window.__game;
    g.world.setArea('shrine');
    g.player.x = 12 * 40 + 7; g.player.y = 7 * 40 + 5;
    g.q.memories = g.q.required;
    g.q.story.stage = 4;
    g.q.sealAnnounced = true;
    delete g.q.story.choices.memory;
    g.closeAsk();
    return true;
  })()`);
  await press('KeyE', 'e');
  check((await evalIn(`window.__game.dialogue.choosing`)) === true, 'the altar offers the Photograph choice');
  await press('Digit1', '1');
  check((await evalIn(`window.__game.q.story.choices.memory`)) === 'investigate', 'pressing "1" records the investigate reply');
  await runDialogue(40);
  check((await evalIn(`window.__game.mode`)) === 'ending', 'the story still reaches the ending after the choice');
  check((await evalIn(`window.__game.q.story.twinRevealed`)) === true, 'the Phase 5 twin reveal still fires unchanged');
  check((await evalIn(`window.__game.others.size`)) === 0, 'no multiplayer behaviour changed by a choice');

  console.log(fail === 0 ? '\nCDP CHOICE PASS' : `\nCDP CHOICE FAIL (${fail})`);
  process.exitCode = fail === 0 ? 0 : 1;
} catch (err) {
  console.error('VERIFY ERROR:', err.message);
  process.exitCode = 1;
} finally {
  for (const p of procs) { try { p.kill('SIGKILL'); } catch {} }
}
