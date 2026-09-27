// Focused remote-presentation check in a real browser pair: interpolation lag
// and convergence, the name tag pixels, and the mounted appearance change.
// Reuses the two-Chromium pattern from cdp_verify.mjs.
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

const ROOM = (process.argv[2] || 'RMT' + Math.floor(Math.random() * 900 + 100)).toUpperCase();
const BASE = process.env.BASE || 'http://127.0.0.1:8080';
const url = `${BASE}/?play=1&room=${ROOM}`;
const procs = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function launch(port) {
  const p = spawn('chromium-browser', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    `--remote-debugging-port=${port}`,
    '--user-data-dir=/tmp/opencode/cdp-r' + port + '-' + Date.now(),
    url,
  ], { stdio: 'ignore' });
  procs.push(p);
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

const key = (a, type, code) => evalIn(a, `(() => { window.dispatchEvent(new KeyboardEvent('${type}',{code:'${code}',key:'${code}'})); return true; })()`);

let fail = 0;
const check = (cond, msg) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg); if (!cond) fail++; };

// Luminance of a pixel offset from the remote's rendered anchor.
const sampleAt = (a, dx, dy) => evalIn(a, `(() => {
  const g = window.__game;
  const o = [...g.others.values()][0];
  if (!o) return null;
  const c = document.getElementById('game').getContext('2d');
  const x = Math.round(o.x + 13) + ${dx}, y = Math.round(o.y + 15) + ${dy};
  const d = c.getImageData(x, y, 1, 1).data;
  return { lum: Math.round(0.299*d[0] + 0.587*d[1] + 0.114*d[2]), r: d[0], g: d[1], b: d[2] };
})()`);

try {
  launch(9335);
  launch(9336);
  const a = await pageTarget(9335);
  const b = await pageTarget(9336);
  await sleep(3000);

  check(await evalIn(a, `window.__game.others.size === 1`), 'A sees the remote player');

  // --- interpolation: move B, watch A's render position lag then converge ---
  await key(b, 'keydown', 'ArrowRight');
  let maxGap = 0;
  const watch = Date.now() + 700;
  while (Date.now() < watch) {
    const gap = await evalIn(a, `(() => { const o = [...window.__game.others.values()][0]; return o ? Math.abs(o.x - o.rx) + Math.abs(o.y - o.ry) : 0; })()`);
    if (gap > maxGap) maxGap = gap;
    await sleep(50);
  }
  await key(b, 'keyup', 'ArrowRight');
  check(maxGap >= 3, `A renders the remote with easing lag (max gap ${maxGap.toFixed(1)}px)`);
  await sleep(800);
  const gapAfter = await evalIn(a, `(() => { const o = [...window.__game.others.values()][0]; return Math.abs(o.x - o.rx) + Math.abs(o.y - o.ry); })()`);
  check(gapAfter <= 2, `render position converges to the network position (gap ${gapAfter.toFixed(1)}px)`);

  // --- name tag: dark plate / cream text / gold frame above the remote -------
  const spots = [[-18, -22], [-18, -16], [0, -22], [0, -16], [18, -22], [18, -16], [-10, -19], [10, -19]];
  let tagPixels = 0;
  for (const [dx, dy] of spots) {
    const s = await sampleAt(a, dx, dy);
    if (!s) continue;
    const dark = s.lum < 70;
    const cream = s.r > 200 && s.g > 180 && s.b > 150;
    const gold = s.r > 150 && s.g > 120 && s.b < 130 && s.r > s.b + 40;
    if (dark || cream || gold) tagPixels++;
  }
  check(tagPixels >= 2, `name tag is drawn above the remote player (${tagPixels} tag pixels)`);

  // --- mounted appearance: white Mount Sheep appears beneath the rider ------
  const before = await sampleAt(a, 0, 9);
  await evalIn(b, `(() => { const g = window.__game; g.q.mountOwned = true; g.mounted = true; return true; })()`);
  let mountedSeen = false;
  for (let i = 0; i < 20 && !mountedSeen; i++) {
    mountedSeen = await evalIn(a, `(() => { const o = [...window.__game.others.values()][0]; return !!(o && o.mounted); })()`);
    if (!mountedSeen) await sleep(100);
  }
  check(mountedSeen, 'mounted state propagates to the remote view');
  const after = await sampleAt(a, 0, 9);
  check(after && before && after.lum > before.lum + 30, `mounted representation renders a lighter mount beneath (${before && before.lum} → ${after && after.lum})`);

  // --- dismount restores the normal appearance -----------------------------
  await evalIn(b, `(() => { window.__game.mounted = false; return true; })()`);
  let dismounted = false;
  for (let i = 0; i < 20 && !dismounted; i++) {
    dismounted = await evalIn(a, `(() => { const o = [...window.__game.others.values()][0]; return !!(o && !o.mounted); })()`);
    if (!dismounted) await sleep(100);
  }
  check(dismounted, 'dismount propagates to the remote view');
  const back = await sampleAt(a, 0, 9);
  check(back && back.lum < after.lum, 'dismount restores the normal (darker) representation');

  console.log(fail === 0 ? '\nCDP REMOTE PASS' : `\nCDP REMOTE FAIL (${fail})`);
  process.exitCode = fail === 0 ? 0 : 1;
} catch (err) {
  console.error('VERIFY ERROR:', err.message);
  process.exitCode = 1;
} finally {
  for (const p of procs) { try { p.kill('SIGKILL'); } catch {} }
}
