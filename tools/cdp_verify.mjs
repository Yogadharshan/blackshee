// Two real Chromium instances (two "players") in one room; assert each sees the other.
// Usage: node tools/cdp_verify.mjs [room]
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

const ROOM = (process.argv[2] || 'E2E' + Math.floor(Math.random() * 900 + 100)).toUpperCase();
const BASE = process.env.BASE || 'http://127.0.0.1:8080';
const url = `${BASE}/?play=1&room=${ROOM}`;
const procs = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function launch(port) {
  const p = spawn('chromium-browser', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    `--remote-debugging-port=${port}`,
    '--user-data-dir=/tmp/opencode/cdp-p' + port + '-' + Date.now(),
    url,
  ], { stdio: 'ignore' });
  procs.push(p);
  return p;
}

async function pageTarget(port) {
  for (let i = 0; i < 60; i++) {
    try {
      const j = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = j.find((t) => t.type === 'page' && t.url.includes(new URL(BASE).host));
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('chromium CDP never came up on ' + port);
}

function evalIn(wsUrl, expression) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const id = 1;
    ws.on('open', () => ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } })));
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.id !== id) return;
      ws.close();
      if (m.result && m.result.exceptionDetails) return reject(new Error(m.result.exceptionDetails.text));
      resolve(m.result && m.result.result ? m.result.result.value : undefined);
    });
    ws.on('error', reject);
    setTimeout(() => { try { ws.close(); } catch {} reject(new Error('eval timeout')); }, 8000);
  });
}

const started = Date.now();
try {
  launch(9333);
  launch(9334);
  const a = await pageTarget(9333);
  const b = await pageTarget(9334);
  await sleep(3000); // connect + exchange a few state frames

  const probe = `(() => { const g = window.__game; return { others: g ? g.others.size : -1, room: g && g.roomCode, me: g && g.myId, playTime: g && g.playTime, connected: window.__net ? window.__net.connected : null, netRoom: window.__net ? window.__net.room : null }; })()`;
  const A = await evalIn(a, probe);
  const B = await evalIn(b, probe);

  console.log('room:', ROOM);
  console.log('playerA:', JSON.stringify(A));
  console.log('playerB:', JSON.stringify(B));
  const ok = A.others === 1 && B.others === 1 && A.room === ROOM && B.room === ROOM;
  console.log(ok ? 'CO-OP RENDER PASS' : 'CO-OP RENDER FAIL');
  console.log('(' + (Date.now() - started) + 'ms)');
  process.exitCode = ok ? 0 : 1;
} catch (err) {
  console.error('VERIFY ERROR:', err.message);
  process.exitCode = 1;
} finally {
  for (const p of procs) { try { p.kill('SIGKILL'); } catch {} }
}
