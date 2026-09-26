import { Game } from './game.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const game = new Game(ctx);
// Test hook: ?play=1 starts in-game for headless screenshot checks. Inert otherwise.
if (new URLSearchParams(location.search).has('play')) game.mode = 'play';

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  game.update(dt);
  game.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);