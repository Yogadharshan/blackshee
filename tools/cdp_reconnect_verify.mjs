// Real Chromium reconnect proof: run an isolated server, connect a browser to a
// room, KILL the relay, confirm the client reports "reconnecting", restart the
// relay, and confirm the client recovers to "open" on its own.
//
// Self-contained: uses its own port (8099) and server process, so it never
// disturbs a running dev server. Usage: node tools/cdp_reconnect_verify.mjs
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

const PORT = Number(process.env.RECONNECT_PORT || 8099);
const CDP_PORT = 9337;
const BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const procs = [];
let conn = null;

function startServer() {
  const p = spawn('node', ['server.js'], {
    cwd: new URL('..', import.meta.url).pathname,
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore',
  });
  procs.push(p);
  return p;
}

async function waitHealth(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(`${BASE}/healthz`);
      if (r.ok) return true;
    } catch { /* not up yet */ }
    await sleep(150);
  }
  return false;
}

function launchBrowser() {
  const p = spawn('chromium-browser', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    `--remote-debugging-port=${CDP_PORT}`,
    '--user-data-dir=/tmp/opencode/cdp-recon-' + Date.now(),
    `${BASE}/?room=RECON`,
  ], { stdio: 'ignore' });
  procs.push(p);
}

async function pageTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const j = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
      const page = j.find((t) => t.type === 'page' && t.url.includes(`127.0.0.1:${PORT}`));
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

// Poll the game's reported net status until it matches (or times out).
async function waitStatus(want, ms) {
  const end = Date.now() + ms;
  let last = null;
  while (Date.now() < end) {
    last = await evalIn(`window.__game && window.__game.netStatus`);
    if (last === want) return true;
    await sleep(200);
  }
  return false;
}

let fail = 0;
const check = (cond, msg) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg); if (!cond) fail++; };

try {
  startServer();
  if (!(await waitHealth(8000))) throw new Error('isolated server never came up');
  launchBrowser();
  conn = await connect(await pageTarget());
  await sleep(1800);

  check(await waitStatus('open', 8000), 'client connects to the room');
  check(await evalIn(`window.__game.roomCode === 'RECON'`), 'joined the requested room');

  // Kill the relay under the client's feet.
  const server = procs.find((p) => p.spawnargs && p.spawnargs[1] === 'server.js');
  server.kill('SIGKILL');
  await sleep(600);
  check(await waitStatus('reconnecting', 6000), 'relay loss → client reports reconnecting');
  check(await evalIn(`window.__game.others.size === 0`), 'ghost partner cleared while offline');

  // Bring it back; the client must recover without a reload.
  startServer();
  if (!(await waitHealth(8000))) throw new Error('restarted server never came up');
  check(await waitStatus('open', 15000), 'client auto-reconnects once the relay is back');
  check(await evalIn(`window.__game.netFlash > 0`), 'reconnect confirmation blip is raised');

  console.log(fail === 0 ? '\nCDP RECONNECT PASS' : `\nCDP RECONNECT FAIL (${fail})`);
  process.exitCode = fail === 0 ? 0 : 1;
} catch (err) {
  console.error('VERIFY ERROR:', err.message);
  process.exitCode = 1;
} finally {
  for (const p of procs) { try { p.kill('SIGKILL'); } catch { /* ignore */ } }
}
