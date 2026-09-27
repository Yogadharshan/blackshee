// Real Chromium: set progress, let it autosave, RELOAD, and confirm Continue
// restores the run. Usage: node tools/cdp_save_verify.mjs
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

const BASE = process.env.BASE || 'http://127.0.0.1:8080';
const PORT = 9339;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const procs = [];
let conn = null;

function launch() {
  const p = spawn('chromium-browser', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=/tmp/opencode/cdp-save-' + Date.now(),
    `${BASE}/?play=1`,
  ], { stdio: 'ignore' });
  procs.push(p);
}
async function pageTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const j = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = j.find((t) => t.type === 'page' && t.url.includes(new URL(BASE).host));
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up */ }
    await sleep(250);
  }
  throw new Error('chromium CDP never came up');
}
function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const c = new WebSocket(wsUrl);
    c.on('open', () => resolve(c));
    c.on('error', reject);
  });
}
function send(method, params) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1e9);
    const onMsg = (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.id !== id) return;
      conn.off('message', onMsg);
      if (m.error) return reject(new Error(m.error.message));
      resolve(m.result);
    };
    conn.on('message', onMsg);
    conn.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { conn.off('message', onMsg); reject(new Error('cdp timeout')); }, 10000);
  });
}
async function evalIn(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result ? r.result.value : undefined;
}

let fail = 0;
const check = (cond, msg) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg); if (!cond) fail++; };

try {
  launch();
  conn = await connect(await pageTarget());
  await sleep(1800);

  // Set a distinctive run, then wait past the 2s autosave.
  await evalIn(`(() => {
    const g = window.__game;
    g.mode = 'play';
    g.q.memories = 2; g.q.side.flowers = 'active'; g.q.mountOwned = true; g.mounted = true;
    g.world.setArea('meadow'); g.player.x = 321; g.player.y = 222;
    return true;
  })()`);
  await sleep(2600);
  check(await evalIn(`!!localStorage.getItem('blackshee.save.v1')`), 'autosave wrote to localStorage');

  // Real reload to the title (no ?play, so the Continue flow runs).
  const ROOT = new URL(BASE).href;
  await evalIn(`location.href = ${JSON.stringify(ROOT)}`);
  await sleep(2300);
  check(await evalIn(`!!window.__game`), 'page reloaded and re-booted');
  check(await evalIn(`window.__game.mode === 'title'`), 'reload lands on the title');
  check(await evalIn(`window.__game.hasSave === true`), 'title sees the save after reload');

  // Press Enter -> Continue.
  await evalIn(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'Enter',key:'Enter'})); window.dispatchEvent(new KeyboardEvent('keyup',{code:'Enter',key:'Enter'})); true`);
  await sleep(300);
  const st = await evalIn(`(() => { const g = window.__game; return { mode: g.mode, mem: g.q.memories, flowers: g.q.side.flowers, area: g.world.area, x: g.player.x, y: g.player.y, mounted: g.mounted }; })()`);
  check(st.mode === 'play', 'Continue enters play');
  check(st.mem === 2 && st.flowers === 'active' && st.area === 'meadow', 'run restored after reload');
  check(st.x === 321 && st.y === 222 && st.mounted === true, 'position + mount restored after reload');

  // Event-driven save raises the "Saved" blip.
  check(await evalIn(`(() => { window.__game.persist(); return window.__game.saveFlash > 0; })()`), 'event save shows the Saved blip');

  // New game clears it.
  await evalIn(`location.href = ${JSON.stringify(ROOT)}`);
  await sleep(2200);
  await evalIn(`window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyN',key:'n'})); window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyN',key:'n'})); true`);
  await sleep(200);
  check(await evalIn(`!localStorage.getItem('blackshee.save.v1')`), '[N] New game clears the save');

  console.log(fail === 0 ? '\nCDP SAVE PASS' : `\nCDP SAVE FAIL (${fail})`);
  process.exitCode = fail === 0 ? 0 : 1;
} catch (err) {
  console.error('VERIFY ERROR:', err.message);
  process.exitCode = 1;
} finally {
  for (const p of procs) { try { p.kill('SIGKILL'); } catch {} }
}
