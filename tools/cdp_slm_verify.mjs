// Real Chromium verification for the Phase 3 local SLM provider.
//
// Default (CI-safe): force the local SLM OFF with ?noai=1 and prove the game
// loads and the scripted fallback answers exactly as before — no crash, no
// inference, no game-state change.
//
// `--real`: also exercise the real WebGPU path (model load + one Elder answer).
// CI must NOT depend on this; it prints what happened and only fails if a
// provider that reached "ready" produced a bad answer.
import { spawn } from 'node:child_process';
import WebSocket from 'ws';
import { selectAnswer } from '../src/data/npc_answers.js';

const REAL = process.argv.includes('--real');
const BASE = process.env.BASE || 'http://127.0.0.1:8080';
const PORT = 9338;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const procs = [];

function launch(query) {
  const p = spawn('chromium-browser', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=/tmp/opencode/cdp-slm-' + Date.now(),
    `${BASE}/${query}`,
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
let conn = null;
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
async function press(code, key) {
  await evalIn(`window.dispatchEvent(new KeyboardEvent('keydown',{code:${JSON.stringify(code)},key:${JSON.stringify(key)}})); true`);
  await sleep(120);
  await evalIn(`window.dispatchEvent(new KeyboardEvent('keyup',{code:${JSON.stringify(code)},key:${JSON.stringify(key)}})); true`);
  await sleep(60);
}

let fail = 0;
const check = (cond, msg) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg); if (!cond) fail++; };

try {
  launch(REAL ? '?play=1' : '?play=1&noai=1');
  conn = await connect(await pageTarget());
  await sleep(1800);

  check(await evalIn(`!!window.__game && !!window.__npcAI`), 'game loads and exposes the debug hook');
  check(await evalIn(`window.__game.playTime > 0`), 'game loop is running');

  if (REAL) {
    // Exploratory: poll the real provider for up to ~90s, then report.
    let ai = null;
    for (let i = 0; i < 90; i++) {
      ai = await evalIn(`window.__npcAI()`);
      if (ai.status === 'ready' || ai.status === 'failed' || ai.status === 'unavailable') break;
      await sleep(1000);
    }
    console.log('  real path:', JSON.stringify(ai));
    if (ai && ai.status === 'ready') {
      const answer = await evalIn(`(async () => {
        const g = window.__game; g.mode='play'; g.world.setArea('village');
        g.player.x = 14*40 - 34; g.player.y = 9*40 + 2; g.closeAsk();
        g.openGuided('elder','Elder Sheep'); g.ask.index = 0; await g.askQuestion();
        return g.ask.answer;
      })()`);
      console.log('  elder SLM answer:', JSON.stringify(answer));
      check(typeof answer === 'string' && answer.length > 0 && answer.length <= 360, 'real SLM: short Elder answer');
      check((await evalIn(`window.__npcAI().inferences`)) >= 1, 'real SLM: inference recorded');
    } else {
      console.log('ok   real SLM not available in this environment (expected headless) — fallback governs');
    }
  }

  // --- Fallback path assertions ----------------------------------------------
  const ai0 = await evalIn(`window.__npcAI()`);
  console.log('  provider status:', JSON.stringify(ai0));
  if (!REAL) {
    check(ai0.disabled === true && ai0.status === 'unavailable' && ai0.selected === 'scripted',
      'forced-off: scripted provider selected, local disabled');
    check(ai0.inferences === 0 && ai0.modelReady === false, 'forced-off: no local inference or model');
  }

  // Memory baseline, then drive the real Elder UI path.
  await evalIn(`(() => {
    const g = window.__game; g.mode='play'; g.world.setArea('village');
    g.player.x = 14*40 - 34; g.player.y = 9*40 + 2; g.closeAsk();
    window.__mem0 = g.q.memories; return true;
  })()`);

  let opened = false;
  for (let i = 0; i < 12 && !opened; i++) {
    await press('KeyE', 'e');
    opened = await evalIn(`window.__game.ask.active`);
  }
  check(opened, 'elder interaction works; guided menu appears');

  await press('1', '1'); // WHO_IS_BAA
  await sleep(REAL ? 400 : 200);
  const a1 = await evalIn(`window.__game.ask.answer`);
  check(typeof a1 === 'string' && a1.length > 0, 'no crash: a non-empty answer is shown');
  if (!REAL) check(a1 === selectAnswer('elder', 'WHO_IS_BAA', 0), 'intent 1 returns the exact scripted answer');

  await press('2', '2'); // WHAT_SHOULD_I_DO
  await sleep(REAL ? 400 : 200);
  const a2 = await evalIn(`window.__game.ask.answer`);
  check(typeof a2 === 'string' && a2.length > 0, 'second intent returns an answer');
  if (!REAL) check(a2 === selectAnswer('elder', 'WHAT_SHOULD_I_DO', 0), 'intent 2 returns the exact scripted answer');
  if (REAL) console.log('  real answers:', JSON.stringify([a1, a2]), 'inferences:',
    await evalIn(`window.__npcAI().inferences`));

  await press('Escape', 'Escape');
  check((await evalIn(`window.__game.ask.active`)) === false, 'Escape leaves the chooser without error');
  check((await evalIn(`window.__game.q.memories`)) === (await evalIn(`window.__mem0`)), 'asking changed no game state');

  console.log(fail === 0 ? '\nCDP SLM-FALLBACK PASS' : `\nCDP SLM-FALLBACK FAIL (${fail})`);
  process.exitCode = fail === 0 ? 0 : 1;
} catch (err) {
  console.error('VERIFY ERROR:', err.message);
  process.exitCode = 1;
} finally {
  for (const p of procs) { try { p.kill('SIGKILL'); } catch {} }
}
