// Two-client browser check for map-aware remote rendering: a remote on another
// area must disappear (no sprite, no tag, no mount), and reappear at its own
// authoritative position once both players share the map. Drives the real
// portal transition, not just the state field.
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

const ROOM = (process.argv[2] || 'MAP' + Math.floor(Math.random() * 900 + 100)).toUpperCase();
const BASE = process.env.BASE || 'http://127.0.0.1:8080';
const url = `${BASE}/?play=1&room=${ROOM}`;
const procs = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function launch(port) {
  const p = spawn('chromium-browser', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    `--remote-debugging-port=${port}`,
    '--user-data-dir=/tmp/opencode/cdp-map' + port + '-' + Date.now(),
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

async function waitFor(a, expr, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await evalIn(a, expr);
    if (v) return v;
    await sleep(100);
  }
  return false;
}

// Count near-white pixels around the remote. Meadow grass is light-green, so
// the wool test requires a high, near-neutral colour (as in cdp_mount_verify).
const lightAroundRemote = (a) => evalIn(a, `(() => {
  const g = window.__game;
  const o = [...g.others.values()][0];
  if (!o) return { light: -1 };
  const c = document.getElementById('game').getContext('2d');
  const x0 = Math.round(o.rx + 13) - 22, y0 = Math.round(o.ry + 15) - 22;
  const img = c.getImageData(x0, y0, 44, 50).data;
  let light = 0;
  for (let i = 0; i < img.length; i += 4) {
    if (img[i] > 190 && img[i + 1] > 185 && img[i + 2] > 165) light++;
  }
  return { light };
})()`);

let fail = 0;
const check = (cond, msg) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg); if (!cond) fail++; };

try {
  launch(9337);
  launch(9338);
  const a = await pageTarget(9337);
  const b = await pageTarget(9338);
  await sleep(3000);

  check(await evalIn(a, `window.__game.others.size === 1`), 'A sees the remote player at start');
  const bid = await evalIn(b, `window.__game.myId`);
  const q = JSON.stringify(bid);
  check(await evalIn(a, `(() => { const o = window.__game.others.get(${q}); return !!o && o.area === 'village'; })()`),
    'remote starts on the same map (village)');

  // Player B walks through the village east door (22,8) -> meadow.
  await evalIn(b, `(() => { const g = window.__game; g.player.x = 22*40+7; g.player.y = 8*40+5; g.portalArmed = true; g.portalLocked = false; g.portalLockUntil = 0; return true; })()`);
  check(await waitFor(b, `window.__game.world.area === 'meadow'`), 'B travels through the portal into the meadow');

  check(await waitFor(a, `(() => { const o = window.__game.others.get(${q}); return !!(o && o.area === 'meadow'); })()`),
    'A receives the remote map change (area=meadow)');
  const onOtherMap = await evalIn(a, `(() => { const g = window.__game; const o = g.others.get(${q}); return {
    has: !!o, area: o && o.area, rendered: g.remotePlayers().length, rx: o && o.rx, x: o && o.x }; })()`);
  check(onOtherMap.rendered === 0, 'A does NOT render the remote on another map');
  check(onOtherMap.rx === onOtherMap.x, 'no cross-map interpolation (render position = authoritative)');

  // Player A follows through the same portal -> meadow.
  await evalIn(a, `(() => { const g = window.__game; g.player.x = 22*40+7; g.player.y = 8*40+5; g.portalArmed = true; g.portalLocked = false; g.portalLockUntil = 0; return true; })()`);
  check(await waitFor(a, `window.__game.world.area === 'meadow'`), 'A travels through the portal into the meadow');

  // Separate them so A's own sprite does not cover the remote for pixel checks.
  await evalIn(a, `(() => { const g = window.__game; g.player.x = 3*40+7; g.player.y = 8*40+5; return true; })()`);
  await evalIn(b, `(() => { const g = window.__game; g.player.x = 6*40+7; g.player.y = 8*40+5; return true; })()`);
  await sleep(300);

  const shared = await evalIn(a, `(() => { const g = window.__game; const o = g.others.get(${q}); return {
    rendered: g.remotePlayers().length, area: o && o.area, dx: o ? Math.abs(o.rx - o.x) : null }; })()`);
  check(shared.rendered === 1, 'remote appears once both players share the map');
  check(shared.area === 'meadow' && shared.dx !== null && shared.dx <= 2,
    'remote appears at its authoritative position (no cross-map slide)');

  // Mounted remote on the same map renders the white mount beneath.
  const before = await lightAroundRemote(a);
  await evalIn(b, `(() => { const g = window.__game; g.q.mountOwned = true; g.mounted = true; return true; })()`);
  check(await waitFor(a, `(() => { const o = window.__game.others.get(${q}); return !!(o && o.mounted); })()`),
    'mounted state propagates while on the same map');
  const after = await lightAroundRemote(a);
  check(after && before && after.light > before.light + 40,
    `mounted remote renders the white mount beneath (${before && before.light} -> ${after && after.light} light px)`);

  // Mounted remote leaves to another map -> disappears entirely.
  await evalIn(b, `(() => { const g = window.__game; g.player.x = 1*40+7; g.player.y = 8*40+5; g.portalArmed = true; g.portalLocked = false; g.portalLockUntil = 0; return true; })()`);
  check(await waitFor(b, `window.__game.world.area === 'village'`), 'B travels back through the portal to the village');
  check(await waitFor(a, `window.__game.remotePlayers().length === 0`),
    'A drops the remote once it leaves the shared map');
  const gone = await evalIn(a, `(() => { const g = window.__game; const o = g.others.get(${q}); return {
    rendered: g.remotePlayers().length, mounted: o && o.mounted }; })()`);
  check(gone.rendered === 0, 'mounted remote on another map is not rendered');
  check(gone.mounted === true, 'remote mounted state is preserved even while hidden');

  console.log(fail === 0 ? '\nCDP MAP PASS' : `\nCDP MAP FAIL (${fail})`);
  process.exitCode = fail === 0 ? 0 : 1;
} catch (err) {
  console.error('VERIFY ERROR:', err.message);
  process.exitCode = 1;
} finally {
  for (const p of procs) { try { p.kill('SIGKILL'); } catch {} }
}
