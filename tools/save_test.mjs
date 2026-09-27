// Headless tests for the localStorage save. Uses a Map-backed localStorage mock.
import { Game } from '../src/game.js';
import { createQuestState } from '../src/systems/quests.js';
import { hasSave, loadSave, writeSave, clearSave, applySave, SAVE_KEY } from '../src/systems/save.js';

const noop = () => {};
const ctx = new Proxy({}, {
  get: (t, k) => (k === 'measureText' ? (s) => ({ width: String(s).length * 8 }) : k === 'canvas' ? { width: 960, height: 640 } : noop),
  set: () => true,
});
globalThis.window = { addEventListener: noop };

let fail = 0;
const check = (cond, msg) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg); if (!cond) fail++; };

// --- no storage -> safe no-op -----------------------------------------------
const realLS = globalThis.localStorage;
globalThis.localStorage = undefined;
check(hasSave() === false, 'no localStorage: hasSave is false');
check(writeSave({ world: { area: 'village' }, player: { x: 1, y: 2 }, q: {}, mounted: false }) === false, 'no localStorage: writeSave is a no-op');
check(loadSave() === null, 'no localStorage: loadSave is null');
clearSave(); // must not throw

// --- Map-backed localStorage ------------------------------------------------
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const fakeGame = () => ({
  world: { area: 'village', setArea(a) { this.area = a; } },
  player: { x: 100, y: 200, speed: 170, moving: true },
  q: { ...createQuestState(), memories: 3 },
  mounted: false,
  portalArmed: true,
  portalLockUntil: 99,
  ask: { active: true, answer: 'x', thinking: true },
});

check(hasSave() === false, 'fresh storage: no save');
const g1 = fakeGame();
g1.world.area = 'meadow';
g1.q.side.flowers = 'active';
check(writeSave(g1) === true && hasSave() === true, 'writeSave stores a save');
const data = loadSave();
check(data && data.v === 1 && data.area === 'meadow' && data.q.memories === 3, 'loadSave returns the stored data');

const g2 = fakeGame();
check(applySave(g2, data) === true, 'applySave restores');
check(g2.world.area === 'meadow' && g2.player.x === 100 && g2.player.y === 200, 'applySave restores area + position');
check(g2.q.memories === 3 && g2.q.side.flowers === 'active', 'applySave restores quest state');
check(g2.portalArmed === false && g2.ask.active === false, 'applySave does not fire a portal and clears the chooser');

// --- merge over a fresh quest state (older/partial save) --------------------
const partial = { v: 1, area: 'village', x: 10, y: 20, mounted: false, q: { memories: 1, side: { flowers: 'done' } } };
const g3 = fakeGame();
applySave(g3, partial);
check(g3.q.side.friend === 'idle' && g3.q.side.rock === 'idle' && g3.q.side.flowers === 'done', 'partial save merges defaults for missing flags');
check(g3.q.secret && g3.q.secret.sixth === false, 'partial save gets the secret sub-object');

// --- mounted restore requires ownership -------------------------------------
g1.q.mountOwned = true;
g1.mounted = true;
g1.player.speed = 300;
writeSave(g1);
const g4 = fakeGame();
applySave(g4, loadSave());
check(g4.mounted === true && g4.player.speed === 300, 'mounted state restored when owned');
const g5 = fakeGame();
applySave(g5, { ...loadSave(), q: { ...loadSave().q, mountOwned: false } });
check(g5.mounted === false && g5.player.speed === 170, 'mounted ignored when the mount is not owned');

// --- version mismatch / corrupt --------------------------------------------
store.set(SAVE_KEY, JSON.stringify({ v: 2, q: { memories: 9 } }));
check(loadSave() === null, 'version mismatch is rejected');
store.set(SAVE_KEY, '{not json');
check(loadSave() === null, 'corrupt save is rejected');

// --- clear ------------------------------------------------------------------
writeSave(g1);
check(hasSave() === true, 'save present before clear');
clearSave();
check(hasSave() === false, 'clearSave removes the save');

// --- integration: a real Game continues from a save -------------------------
const live = new Game(ctx);
live.q.memories = 2;
live.q.side.flowers = 'active';
live.world.setArea('meadow');
live.player.x = 123;
live.player.y = 456;
live.q.mountOwned = true;
live.mounted = true;
live.player.speed = 300;
writeSave(live);

const cont = new Game(ctx);
check(cont.mode === 'title' && cont.hasSave === true, 'title offers Continue when a save exists');
cont.advance = true;
cont.update(1 / 60);
check(cont.mode === 'play', 'Enter continues into play');
check(cont.q.memories === 2 && cont.q.side.flowers === 'active' && cont.world.area === 'meadow', 'Continue restores the run');
check(cont.player.x === 123 && cont.player.y === 456 && cont.mounted === true, 'Continue restores position + mount');

const fresh = new Game(ctx);
check(fresh.hasSave === true, 'a later game still sees the save until New game');
clearSave();
check(new Game(ctx).hasSave === false, 'New game leaves no save');
check((() => { const n = new Game(ctx); n.advance = true; n.update(1 / 60); return n.mode === 'play' && n.q.memories === 0; })(), 'fresh run still just presses Enter');

// --- "Saved" blip -----------------------------------------------------------
const blip = new Game(ctx);
blip.mode = 'play';
blip.persist();
check(blip.saveFlash > 0, 'event save raises the blip');
blip.update(1 / 60);
check(blip.saveFlash > 0 && blip.saveFlash < 1.4, 'blip fades over time');
const noStorage = globalThis.localStorage;
globalThis.localStorage = undefined;
const quiet = new Game(ctx);
quiet.saveFlash = 0;
quiet.persist();
check(quiet.saveFlash === 0, 'no-storage save shows no blip');
globalThis.localStorage = noStorage;

globalThis.localStorage = realLS;
console.log(fail === 0 ? '\nSAVE PASS' : `\nSAVE FAIL (${fail})`);
process.exit(fail === 0 ? 0 : 1);
