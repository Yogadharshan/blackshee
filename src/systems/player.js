import { TILE } from '../data/world.js';
import { rectBlocked } from './collision.js';

export class Player {
  constructor(startX, startY) {
    this.x = startX;
    this.y = startY;
    this.w = 26;
    this.h = 30;
    this.speed = 170;
    this.dir = { x: 0, y: 1 };
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  update(keys, tiles, blockers, dt) {
    let dx = 0, dy = 0;
    if (keys['KeyW'] || keys['ArrowUp']) dy = -1;
    if (keys['KeyS'] || keys['ArrowDown']) dy = 1;
    if (keys['KeyA'] || keys['ArrowLeft']) dx = -1;
    if (keys['KeyD'] || keys['ArrowRight']) dx = 1;
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      dx /= len; dy /= len;
      this.dir = { x: dx, y: dy };
    }
    const step = this.speed * dt;

    // Move X, then Y, checking tiles and actor bodies separately so we slide.
    const nx = this.x + dx * step;
    const newRectX = { x: nx, y: this.y, w: this.w, h: this.h };
    if (!rectBlocked(tiles, newRectX.x, newRectX.y, newRectX.w, newRectX.h) && !hitsAny(blockers, newRectX)) {
      this.x = nx;
    }
    const ny = this.y + dy * step;
    const newRectY = { x: this.x, y: ny, w: this.w, h: this.h };
    if (!rectBlocked(tiles, newRectY.x, newRectY.y, newRectY.w, newRectY.h) && !hitsAny(blockers, newRectY)) {
      this.y = ny;
    }

    this.x = Math.max(0, Math.min(this.x, TILE * 24 - this.w));
    this.y = Math.max(0, Math.min(this.y, TILE * 16 - this.h));
  }

  draw(ctx) {
    const fluffy = wobble();
    // black wool body
    ctx.fillStyle = '#2b2b33';
    ctx.beginPath();
    ctx.ellipse(this.cx, this.cy + 2, this.w / 2 + fluffy, this.h / 2 - 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // darker legs
    ctx.fillStyle = '#1c1c22';
    ctx.fillRect(this.cx - 10, this.cy + 8, 5, 8);
    ctx.fillRect(this.cx + 5, this.cy + 8, 5, 8);
    // head (faces move direction)
    const hx = this.cx + this.dir.x * 6;
    const hy = this.cy + this.dir.y * 6;
    ctx.fillStyle = '#33333d';
    ctx.beginPath();
    ctx.arc(hx, hy, 8, 0, Math.PI * 2);
    ctx.fill();
    // ears
    ctx.fillStyle = '#2b2b33';
    ctx.beginPath();
    ctx.ellipse(hx - 9, hy - 3, 4, 3, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(hx + 9, hy - 3, 4, 3, 0.6, 0, Math.PI * 2);
    ctx.fill();
    // eyes
    ctx.fillStyle = '#f2f2f2';
    ctx.beginPath();
    ctx.arc(hx - 3, hy - 1, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(hx + 3, hy - 1, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Gentle idle breathing so sheep feel alive.
function wobble() {
  return Math.sin(Date.now() / 500) * 0.8;
}

function hitsAny(actors, rect) {
  for (const a of actors) {
    if (a === undefined) continue;
    const aw = a.w !== undefined ? a.w : 32;
    const ah = a.h !== undefined ? a.h : 32;
    if (rect.x < a.px + aw && rect.x + rect.w > a.px &&
        rect.y < a.py + ah && rect.y + rect.h > a.py) return true;
  }
  return false;
}