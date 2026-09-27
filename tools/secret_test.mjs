// Focused single-player secret-path test: three pokes of the secret tree reveal
// the hidden doorway to Nowhere (sixth Memory territory). Verifies pokes 1-2
// stay quiet, poke 3 discovers + plays the reveal, the forest tile (13,5)
// flips S -> D once discovered, and the secret door at forest(5,13) opens.
import { Game } from '../src/game.js';
import { TILE } from '../src/data/world.js';

const noop = () => {};
const ctx = new Proxy({}, {
  get: (t, k) => {
    if (k === 'measureText') return (s) => ({ width: String(s).length * 8 });
    if (k === 'canvas') return { width: 960, height: 640 };
    return noop;
  },
  set: () => true,
});
globalThis.window = { addEventListener: noop };
globalThis.localStorage = undefined;

let fail = 0;
const check = (cond, msg) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg); if (!cond) fail++; };

const dialogText = (g) => (g.dialogue.lines || []).map((l) => (Array.isArray(l) ? l[1] : l)).join(' ');
const finishDialogue = (g) => {
  let guard = 0;
  while (g.dialogue.active && guard < 40) { g.advance = true; g.update(1 / 60); guard++; }
};
const poke = (g) => { g.advance = true; g.update(1 / 60); };

// Stand next to the secret tree (hotspot x5 y13, tile 'S') without stepping on it.
const g = new Game(ctx);
g.mode = 'play';
g.world.setArea('forest');
g.player.x = 4 * TILE + 8; g.player.y = 13 * TILE + 5;

// --- 1. pokes 1 and 2 do not discover ----------------------------------------
poke(g);
check(g.q.secret.treePokes === 1 && g.q.secret.discovered === false, 'poke 1: treePokes=1, still hidden');
check(/It's a tree/i.test(dialogText(g)), 'poke 1 plays tree1');
finishDialogue(g);
poke(g);
check(g.q.secret.treePokes === 2 && g.q.secret.discovered === false, 'poke 2: treePokes=2, still hidden');
check(/Still a tree/i.test(dialogText(g)), 'poke 2 plays tree2');
finishDialogue(g);

// --- 2. the third poke discovers and plays the reveal -------------------------
poke(g);
check(g.q.secret.treePokes === 3 && g.q.secret.discovered === true, 'poke 3: discovered=true');
check(/hidden path appeared/i.test(dialogText(g)), 'poke 3 plays tree_reveal ("A hidden path appeared.")');
finishDialogue(g);

// --- 3. discovered + a forest update flips tile row13 col5 S -> D -------------
g.advance = true; g.update(1 / 60);
check(g.world.area === 'forest' && g.world.tiles[13][5] === 'D', 'forest tile (13,5) flips S -> D once discovered');

// --- 4. standing on the secret door with discovered opens Nowhere -------------
finishDialogue(g);
g.player.x = 5 * TILE; g.player.y = 13 * TILE;
g.advance = true; g.update(1 / 60);
check(g.world.area === 'hidden', 'secret door at forest(5,13) transitions to the hidden area');

console.log(fail === 0 ? '\nSECRET PASS' : `\nSECRET FAIL (${fail})`);
process.exit(fail === 0 ? 0 : 1);