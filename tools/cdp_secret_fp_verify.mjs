// Focused first-person secret-tree verification (single browser, mounted).
// Proves the secret tree is visible/interactable in first-person and that the
// discovery -> doorway -> return flow still works.
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

const BASE = process.env.BASE || 'http://127.0.0.1:8080';
const PORT = 9341;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const procs = [];
let conn = null;

function launch() {
  const p = spawn('chromium-browser', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=/tmp/opencode/cdp-fp-' + Date.now(),
    `${BASE}/?play=1&mount=1`,
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
function connect(u) { return new Promise((res, rej) => { const c = new WebSocket(u); c.on('open', () => res(c)); c.on('error', rej); }); }
function send(method, params) {
  return new Promise((res, rej) => {
    const id = Math.floor(Math.random() * 1e9);
    const on = (raw) => { const m = JSON.parse(raw.toString()); if (m.id !== id) return; conn.off('message', on); if (m.error) return rej(new Error(m.error.message)); res(m.result); };
    conn.on('message', on);
    conn.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { conn.off('message', on); rej(new Error('cdp timeout')); }, 8000);
  });
}
async function ev(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
  return r.result ? r.result.value : undefined;
}
const press = async (code, key) => {
  await ev(`window.dispatchEvent(new KeyboardEvent('keydown',{code:${JSON.stringify(code)},key:${JSON.stringify(key)}})); true`);
  await sleep(120);
  await ev(`window.dispatchEvent(new KeyboardEvent('keyup',{code:${JSON.stringify(code)},key:${JSON.stringify(key)}})); true`);
  await sleep(120);
};

let fail = 0;
const check = (cond, msg) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg); if (!cond) fail++; };

const sample = (y) => ev(`(() => {
  const d = document.getElementById('game').getContext('2d').getImageData(480, ${y}, 1, 1).data;
  return { r: d[0], g: d[1], b: d[2], lum: Math.round(0.299*d[0] + 0.587*d[1] + 0.114*d[2]) };
})()`);
const wallish = (s) => s && s.lum < 88 && s.g > s.r && s.r > s.b;

try {
  launch();
  conn = await connect(await pageTarget());
  await sleep(1600);

  check(await ev(`window.__game.mounted === true`), 'starts mounted (first-person active)');
  await ev(`(() => { const g=window.__game; g.mode='play'; g.q.mountOwned=true; g.mounted=true; g.player.speed=300; g.world.setArea('forest'); g.dialogue.active=false; return true; })()`);
  await sleep(250);

  // Hint is not premature: far from the tree there is nothing to interact with.
  await ev(`(() => { const g=window.__game; g.player.x=4*40+7; g.player.y=5*40+5; g.player.dir={x:1,y:0}; return true; })()`);
  await sleep(250);
  check(await ev(`(() => { const n=window.__game.near; return !n || n.ref.id !== 'secretTree'; })()`),
    'no secret-tree interaction when far away');

  // Approach and face the tree.
  const memBefore = await ev(`window.__game.q.memories`);
  await ev(`(() => { const g=window.__game; g.player.x=4*40+7; g.player.y=13*40+5; g.player.dir={x:1,y:0}; return true; })()`);
  await sleep(300);
  check(await ev(`(() => { const n=window.__game.near; return !!n && n.ref.id === 'secretTree'; })()`),
    'adjacent to the secret tree while mounted');

  // The tree must be a visible near wall (fills the column) — not see-through.
  const near = [await sample(200), await sample(300), await sample(460)];
  check(near.every(wallish), `secret tree renders as a near wall (${near.map((s) => s && s.lum).join('/')})`);

  // Interact: existing tree hint, no progression change.
  await press('KeyE', 'e');
  const afterE = await ev(`(() => { const g=window.__game; return { active: g.dialogue.active, pokes: g.q.secret.treePokes, mem: g.q.memories, line: g.dialogue.lines && g.dialogue.lines[0] }; })()`);
  check(afterE.active === true && afterE.pokes === 1, 'E opens the existing secret-tree hint while mounted');
  check(afterE.mem === memBefore, 'poking the tree changes no progression');

  // Discovery opens the existing doorway; walk in.
  await ev(`(() => { const g=window.__game; g.dialogue.active=false; g.q.secret.discovered=true; return true; })()`);
  await sleep(250);
  check(await ev(`window.__game.world.tiles[13][5] === 'D'`), 'discovered secret tree becomes a walkable doorway');
  await ev(`(() => { const g=window.__game; g.player.x=5*40+7; g.player.y=13*40+5; g.portalArmed=true; g.portalLocked=false; g.portalLockUntil=0; return true; })()`);
  await sleep(350);
  check(await ev(`window.__game.world.area === 'hidden'`), 'player enters the hidden area through the revealed doorway');

  // Return through the existing door.
  await ev(`(() => { const g=window.__game; g.player.x=2*40+7; g.player.y=8*40+5; g.portalArmed=false; return true; })()`);
  await sleep(160);
  await ev(`(() => { const g=window.__game; g.player.x=1*40+7; g.player.y=8*40+5; g.portalArmed=true; g.portalLocked=false; g.portalLockUntil=0; return true; })()`);
  await sleep(350);
  check(await ev(`window.__game.world.area === 'forest'`), 'return door works');
  check(await ev(`window.__game.q.secret.discovered === true`), 'secret state is preserved');

  console.log(fail === 0 ? '\nCDP FIRST-PERSON SECRET PASS' : `\nCDP FIRST-PERSON SECRET FAIL (${fail})`);
  process.exitCode = fail === 0 ? 0 : 1;
} catch (err) {
  console.error('VERIFY ERROR:', err.message);
  process.exitCode = 1;
} finally {
  for (const p of procs) { try { p.kill('SIGKILL'); } catch {} }
}
