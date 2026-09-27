import { TILE } from '../data/world.js';
import { rectBlocked } from './collision.js';
import { sprites, spr, sheepPose } from './sprites.js';

export class Player {
  constructor(startX, startY) {
    this.x = startX;
    this.y = startY;
    this.w = 26;
    this.h = 30;
    this.speed = 170;
    this.dir = { x: 0, y: 1 };
    this.moving = false;
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
      this.moving = true;
    } else {
      this.moving = false;
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

  // Mounted: the black rider sits on top of the white Mount Sheep. Same
  // top-down camera; only the sprite pair and speed change with mounting.
  draw(ctx, mounted = false) {
    const t = performance.now();
    const flip = this.dir.x < 0;
    // soft ground shadow
    ctx.fillStyle = 'rgba(30,20,10,0.25)';
    ctx.fillRect(this.x + 4, this.y + this.h - 4, this.w - 8, 5);

    if (mounted) {
      const mount = sheepPose(sprites().sheepWhite, this.moving, t);
      const rider = sheepPose(sprites().sheepBlack, this.moving, t);
      const baseY = this.y + this.h - rider.img.height + rider.bob - 3;
      const mx = this.x + (this.w - mount.img.width) / 2;
      const rx = this.x + (this.w - rider.img.width) / 2;
      spr(ctx, mount.img, mx, baseY + 11, flip); // white mount beneath
      spr(ctx, rider.img, rx, baseY, flip);      // black rider on top
      return;
    }

    const { img, bob } = sheepPose(sprites().sheepBlack, this.moving, t);
    const ix = this.x + (this.w - img.width) / 2;
    const iy = this.y + this.h - img.height + bob - 3;
    spr(ctx, img, ix, iy, flip);
  }
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