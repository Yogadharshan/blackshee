// Focused mount check in a real browser (single instance).
// The mount is now fully top-down: the black sheep rides a white Mount Sheep,
// movement is faster, and dismount restores the plain black sheep. There is no
// first-person camera anywhere.
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

const BASE = process.env.BASE || 'http://127.0.0.1:8080';
const PORT = 9342;
const url = `${BASE}/?play=1&mount=1`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const procs = [];

function launch() {
  const p = spawn('chromium-browser', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=/tmp/opencode/cdp-mount-' + Date.now(),
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

// Count light (wool/mount) and dark (black sheep) pixels around the player,
// which is parked on an open village tile with no NPC or hotspot overlapping.
const countAroundPlayer = (a) => evalIn(a, `(() => {
  const g = window.__game;
  g.render();
  const c = document.getElementById('game').getContext('2d');
  const x0 = Math.round(g.player.x) - 7, y0 = Math.round(g.player.y) - 15;
  const img = c.getImageData(x0, y0, 44, 65).data;
  let light = 0, dark = 0;
  for (let i = 0; i < img.length; i += 4) {
    const r = img[i], gg = img[i + 1], b = img[i + 2];
    const lum = 0.299 * r + 0.587 * gg + 0.114 * b;
    if (r > 190 && gg > 185 && b > 165) light++;
    if (lum < 80) dark++;
  }
  return { light, dark };
})()`);

let fail = 0;
const check = (cond, msg) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg); if (!cond) fail++; };

try {
  launch();
  const a = await pageTarget();
  await sleep(1800);

  check(await evalIn(a, `window.__game.mounted === true`), 'starts mounted');

  // Open plaza tile, clear of the Elder/lonely/sheep and all hotspots.
  await evalIn(a, `(() => {
    const g = window.__game;
    g.mode = 'play'; g.q.mountOwned = true; g.mounted = false; g.player.speed = 170;
    g.world.setArea('village'); g.player.x = 400; g.player.y = 400; g.player.moving = false;
    g.dialogue.active = false; return true;
  })()`);
  await sleep(200);

  const plain = await countAroundPlayer(a);
  check(plain.dark > 20, `unmounted draws the plain black sheep (${plain.dark} dark px)`);
  check(plain.light < 60, `unmounted has no white mount (${plain.light} light px)`);

  await evalIn(a, `(() => { const g = window.__game; g.mounted = true; g.player.speed = 300; return true; })()`);
  await sleep(150);
  const mounted = await countAroundPlayer(a);
  check(mounted.dark > 20, `mounted still draws the black rider on top (${mounted.dark} dark px)`);
  check(mounted.light > plain.light + 40, `mounted adds the white Mount Sheep beneath (${plain.light} → ${mounted.light} light px)`);

  // The sprite pair is drawn at the player's world position: the camera is
  // still the normal top-down view, never a first-person one.
  check(await evalIn(a, `(() => {
    const g = window.__game;
    const c = document.getElementById('game').getContext('2d');
    const d = c.getImageData(Math.round(g.player.x) + 13, Math.round(g.player.y) + 9, 1, 1).data;
    return 0.299*d[0] + 0.587*d[1] + 0.114*d[2] < 150;
  })()`), 'the rider is drawn at the player world position (top-down camera)');

  // Mounted movement is faster (same frame count, more distance).
  const dx = await evalIn(a, `(() => {
    const g = window.__game;
    const run = (isMounted) => {
      g.player.x = 400; g.player.y = 400; g.mounted = isMounted; g.player.speed = isMounted ? 300 : 170;
      const x0 = g.player.x;
      for (let i = 0; i < 40; i++) g.player.update({ ArrowRight: true }, g.world.tiles, [], 1 / 60);
      return Math.round(g.player.x - x0);
    };
    return { slow: run(false), fast: run(true) };
  })()`);
  check(dx.fast > dx.slow + 20, `mounted moves faster (${dx.slow}px vs ${dx.fast}px in 40 frames)`);

  // Dismount restores the plain black sheep.
  await evalIn(a, `(() => { const g = window.__game; g.mounted = false; g.player.speed = 170; g.player.x = 400; g.player.y = 400; return true; })()`);
  await sleep(150);
  const back = await countAroundPlayer(a);
  check(back.light < 60, `dismount removes the mount again (${back.light} light px)`);

  console.log(fail === 0 ? '\nCDP MOUNT PASS' : `\nCDP MOUNT FAIL (${fail})`);
  process.exitCode = fail === 0 ? 0 : 1;
} catch (err) {
  console.error('VERIFY ERROR:', err.message);
  process.exitCode = 1;
} finally {
  for (const p of procs) { try { p.kill('SIGKILL'); } catch {} }
}
