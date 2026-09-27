// One real Chromium: drive the guided-conversation keyboard path end to end.
// Verifies the keydown wiring that unit tests bypass (open chooser, navigate,
// ask, ask again, leave). Usage: node tools/cdp_ask_verify.mjs
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

const BASE = process.env.BASE || 'http://127.0.0.1:8080';
const PORT = 9337;
const url = `${BASE}/?play=1`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const procs = [];

function launch() {
  const p = spawn('chromium-browser', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=/tmp/opencode/cdp-ask-' + Date.now(),
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
  await sleep(120);
  await evalIn(`window.dispatchEvent(new KeyboardEvent('keyup',{code:${JSON.stringify(code)},key:${JSON.stringify(key)}})); true`);
  await sleep(60);
}

let fail = 0;
const check = (cond, msg) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg); if (!cond) fail++; };

try {
  launch();
  connect(await pageTarget()).then((c) => { ws.conn = c; });
  // wait for connect
  for (let i = 0; i < 40 && !ws.conn; i++) await sleep(200);
  await sleep(1500);

  // Park the player in talk range of the Elder, remember memory count.
  await evalIn(`(() => {
    const g = window.__game;
    g.mode = 'play';
    g.world.setArea('village');
    g.player.x = 14 * 40 - 34;
    g.player.y = 9 * 40 + 2;
    g.closeAsk();
    window.__mem0 = g.q.memories;
    return true;
  })()`);

  // Advance the authored opening with real E presses until the chooser opens.
  let opened = false;
  for (let i = 0; i < 12 && !opened; i++) {
    await press('KeyE', 'e');
    opened = await evalIn(`window.__game.ask.active`);
  }
  check(opened, 'real keydown: opening dialogue -> guided chooser appears');
  const intents = await evalIn(`window.__game.ask.intents.slice()`);
  check(Array.isArray(intents) && intents.length === 5, `elder chooser lists 5 intents (${intents.join(', ')})`);

  // Navigate down with the keyboard.
  await press('ArrowDown', 'ArrowDown');
  check((await evalIn(`window.__game.ask.index`)) === 1, 'ArrowDown moves the selection');

  // Ask via number key 1 (WHO_IS_BAA), real keydown path.
  await press('1', '1');
  await sleep(150);
  const a1 = await evalIn(`window.__game.ask.answer`);
  check(typeof a1 === 'string' && a1.length > 0, 'keyboard ask produces a scripted answer');
  check(!/grandchild/i.test(a1 || ''), 'early answer does not leak the stage-5 revelation');

  // Ask a second question in the same interaction.
  await press('2', '2');
  await sleep(150);
  const a2 = await evalIn(`window.__game.ask.answer`);
  check(typeof a2 === 'string' && a2.length > 0 && a2 !== a1, 'a second question returns a different answer');
  check(await evalIn(`window.__game.ask.active`), 'chooser stays open after answering');

  // Leave with Escape; state unchanged.
  await press('Escape', 'Escape');
  check((await evalIn(`window.__game.ask.active`)) === false, 'Escape leaves the chooser');
  check((await evalIn(`window.__game.q.memories`)) === (await evalIn(`window.__mem0`)), 'asking questions did not change Memories');

  console.log(fail === 0 ? '\nCDP ASK-UI PASS' : `\nCDP ASK-UI FAIL (${fail})`);
  process.exitCode = fail === 0 ? 0 : 1;
} catch (err) {
  console.error('VERIFY ERROR:', err.message);
  process.exitCode = 1;
} finally {
  for (const p of procs) { try { p.kill('SIGKILL'); } catch {} }
}
