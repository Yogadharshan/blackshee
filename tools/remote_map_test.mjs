// Focused tests for map-aware remote visibility. Maps are independent
// coordinate spaces: a remote on another area must never be drawn, and its
// coordinates must never interpolate into the local map.
import { Game } from '../src/game.js';

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
g.world.setArea('village');

const R = 'r1';
const sync = (area, x, y, mounted = false) => g.syncPlayers([{ id: R, x, y, area, mounted }], null);
const rem = () => g.others.get(R);
const visible = () => g.remotePlayers().some((o) => o.id === R);

// CASE A: same map -> rendered.
sync('village', 100, 100);
check(visible() && g.remotePlayers().length === 1, 'A: same map -> remote is rendered');
check(rem().rx === 100 && rem().ry === 100, 'A: render position starts at the authoritative spot');

// CASE B: different map -> not rendered.
sync('forest', 100, 100);
check(!visible() && g.remotePlayers().length === 0, 'B: other map -> remote is not rendered');

// CASE C: remote changes village -> forest; interpolation state resets.
sync('village', 500, 300);
g.updateOthers(1 / 60); // let rx settle at 500 on the village baseline
sync('forest', 80, 120);
check(rem().rx === 80 && rem().ry === 120,
  'C: map change resets rx/ry to the authoritative coords (no 500,300 -> 80,120 slide)');
check(!visible(), 'C: remote on the new map is hidden from the old map');

// CASE D: local changes village -> forest, remote already forest.
g.world.setArea('forest');
check(visible(), 'D: once the local map matches, the remote appears');
check(rem().rx === 80 && rem().ry === 120, 'D: it appears at its authoritative forest position');

// Same-map movement eases again after the map match.
sync('forest', 150, 120);
g.updateOthers(1 / 60);
check(rem().rx > 80 && rem().rx < 150, 'D: same-map movement resumes easing');

// CASE E: remote changes forest -> village while local stays forest.
sync('village', 60, 60);
check(!visible(), 'E: remote leaving to another map disappears immediately');

// CASE F: mounted remote on the same map still renders (mounted).
g.world.setArea('village');
sync('village', 300, 300, true);
check(visible() && rem().mounted === true, 'F: mounted remote on the same map renders (mounted)');

// CASE G: mounted remote on another map is not rendered, with no cross-map state.
g.world.setArea('forest');
check(!visible(), 'G: mounted remote on another map is not rendered');
check(rem().rx === rem().x && rem().ry === rem().y, 'G: no cross-map interpolation state');

console.log(fail === 0 ? '\nREMOTE MAP PASS' : `\nREMOTE MAP FAIL (${fail})`);
process.exit(fail === 0 ? 0 : 1);
