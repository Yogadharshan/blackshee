// Headless tests for remote-player presentation state: interpolation, snap on
// teleport, mounted pass-through, and disconnect/reconnect cleanup. Visual
// verification (tags/pixels) is covered by the browser checks.
import { Game, remoteTagText } from '../src/game.js';

const noop = () => {};
const ctx = new Proxy({}, {
  get: (t, k) => (k === 'measureText' ? (s) => ({ width: String(s).length * 8 }) : noop),
  set: () => true,
});
globalThis.window = { addEventListener: noop };

let fail = 0;
const check = (cond, msg) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg); if (!cond) fail++; };

const g = new Game(ctx);
g.mode = 'play';
g.myId = 'me';

// --- interpolation ----------------------------------------------------------
g.syncPlayers([{ id: 'r1', x: 100, y: 100, area: 'village', mounted: false }], null);
check(g.others.get('r1').rx === 100 && g.others.get('r1').ry === 100,
  'new remote starts at the received position (no stale interpolation)');

g.syncPlayers([{ id: 'r1', x: 140, y: 100, area: 'village', mounted: false }], null);
check(g.others.get('r1').x === 140 && g.others.get('r1').rx === 100,
  'network target updates while the render position eases from the old spot');

g.updateOthers(1 / 60);
const rxA = g.others.get('r1').rx;
check(rxA > 100 && rxA < 140, 'render position moves toward the target instead of snapping');

for (let i = 0; i < 180; i++) g.updateOthers(1 / 60);
check(Math.abs(g.others.get('r1').rx - 140) < 1, 'render position converges to the target');
check(g.others.get('r1').rx <= 140, 'render position does not overshoot');

// --- snap on teleport -------------------------------------------------------
g.syncPlayers([{ id: 'r1', x: 900, y: 100, area: 'village', mounted: false }], null);
check(g.others.get('r1').rx === 900, 'a large jump snaps instead of sliding (area change)');

// --- mounted pass-through ---------------------------------------------------
g.syncPlayers([{ id: 'r1', x: 900, y: 100, area: 'village', mounted: true }], null);
check(g.others.get('r1').mounted === true, 'mounted state flows through unchanged');
g.syncPlayers([{ id: 'r1', x: 900, y: 100, area: 'village', mounted: false }], null);
check(g.others.get('r1').mounted === false, 'dismount flows through unchanged');

// --- identity label ---------------------------------------------------------
check(remoteTagText() === 'Black Sheep', 'tag text is the minimal deterministic label');

// --- disconnect / reconnect -------------------------------------------------
g.onNetStatus('reconnecting', {});
check(g.others.size === 0, 'disconnect clears the remote visual state');

g.onNetStatus('open', { recovered: true });
g.syncPlayers([{ id: 'r2', x: 300, y: 300, area: 'village', mounted: true }], null);
const r2 = g.others.get('r2');
check(r2.rx === 300 && r2.ry === 300 && r2.mounted === true,
  'reconnect appears cleanly at the new position with current mounted state');

// --- local player untouched -------------------------------------------------
const px = g.player.x, py = g.player.y;
g.update(1 / 60);
check(g.player.x === px && g.player.y === py, 'local player is not moved by remote interpolation');

console.log(fail === 0 ? '\nREMOTE POLISH PASS' : `\nREMOTE POLISH FAIL (${fail})`);
process.exit(fail === 0 ? 0 : 1);
