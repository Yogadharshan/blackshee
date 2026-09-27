import { Game } from './game.js';
import { net } from './systems/net.js';
import { npcDialogue } from './systems/npc_dialogue.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const game = new Game(ctx);
// Dev hooks so automated checks (tools/*.mjs) can inspect real browser state.
window.__game = game;
window.__net = net;
window.__npcDialogue = npcDialogue;
// Debug hook: provider selection, WebGPU, import/model/inference state, fallback.
window.__npcAI = () => npcDialogue.debug();

const hp = new URLSearchParams(location.search);
// Test hooks: ?play=1 starts in-game; &mount=1 grants+mounts. ?noai=1 force-disables
// the local SLM so verification can exercise the scripted fallback path.
if (hp.has('noai')) npcDialogue.disableLocal();
if (hp.has('play')) game.mode = 'play';
if (hp.has('mount')) {
  game.q.mountOwned = true;
  game.mounted = true;
  game.player.speed = 300;
}

// Provider selection: scripted immediately; the optional local SLM is attempted
// once in the background and never blocks the game. The talk flow is unchanged.
npcDialogue.initialize();

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  game.update(dt);
  game.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
