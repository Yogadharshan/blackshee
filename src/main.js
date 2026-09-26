import { Game } from './game.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const game = new Game(ctx);
// Test hooks: ?play=1 starts in-game; &mount=1 grants+mounts for screenshot checks. Inert otherwise.
const hp = new URLSearchParams(location.search);
if (hp.has('play')) game.mode = 'play';
if (hp.has('mount')) {
  game.q.mountOwned = true;
  game.mounted = true;
  game.player.speed = 300;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  game.update(dt);
  game.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);