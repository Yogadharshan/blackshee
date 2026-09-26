import { AREAS, TILE, LEGEND, DOORS } from '../data/world.js';
import { NPCS } from '../data/npcs.js';
import { HOTSPOTS } from '../data/collectibles.js';
import { spr, treeSprite, houseSprite, rockSprite, envSprites } from './sprites.js';

export class World {
  constructor() {
    this.area = 'village';
    this.setArea('village');
  }

  setArea(name) {
    this.area = name;
    this.def = AREAS[name];
    this.tiles = this.def.tiles.map((row) => row.split(''));
    this.npcs = NPCS.filter((n) => n.area === name).map((n) => ({ ...n, px: n.x * TILE, py: n.y * TILE }));
    this.hotspots = HOTSPOTS.filter((h) => h.area === name).map((h) => ({ ...h, px: h.x * TILE, py: h.y * TILE }));
  }

  doorAt(tx, ty) {
    return DOORS.find((d) => d.from === this.area && d.x === tx && d.y === ty) || null;
  }

  draw(ctx, game) {
    const { tiles } = this;
    const t = performance.now();
    for (let y = 0; y < tiles.length; y++) {
      for (let x = 0; x < tiles[y].length; x++) {
        const ch = tiles[y][x];
        const info = LEGEND[ch] || LEGEND['.'];
        const px0 = x * TILE;
        const py0 = y * TILE;

        // base ground
        ctx.fillStyle = info.solid && false ? info.color : (ch === '.' ? '#90b95c' : ch === '-' ? '#d9c07a' : info.color);
        ctx.fillRect(px0, py0, TILE, TILE);

        switch (info.draw) {
          case 'tree':
            spr(ctx, treeSprite((x + y) % 3), px0, py0 - 6);
            shade(ctx, px0, py0, 10);
            break;
          case 'building':
            spr(ctx, houseSprite((x + y) % 2), px0 + 2, py0 - 2);
            break;
          case 'rock':
            spr(ctx, rockSprite((x + y) % 2), px0 + 12, py0 + 13);
            break;
          case 'fence':
            drawFence(ctx, px0, py0);
            break;
          case 'water':
            drawWater(ctx, px0, py0, t, x, y);
            break;
          case 'flowers':
            drawFlower(ctx, px0, py0, t, x, y);
            break;
          case 'door':
          case 'gate':
            drawDoor(ctx, px0, py0, ch === 'X', game && game.q ? game.q.memories >= game.q.required : ch !== 'X');
            break;
          default:
            if (!info.solid) addTexture(ctx, px0, py0, ch, x, y);
        }
      }
    }
  }
}

// subtle deterministic ground texture (stable per tile)
function addTexture(ctx, px, py, ch, x, y) {
  const h = (x * 7 + y * 13) % 113;
  if (ch === '.') {
    if (h < 14) {
      ctx.fillStyle = '#6f9c47';
      ctx.fillRect(px + ((x * 5 + y * 3) % 34) + 2, py + ((y * 7 + x * 11) % 34) + 2, 2, 2);
    }
    if (h < 4) {
      const e = envSprites();
      spr(ctx, e.tuft, px + ((x * 3) % 30) + 3, py + ((y * 5) % 30) + 4);
    }
  } else if (ch === '-') {
    if (h > 92) {
      ctx.fillStyle = '#b7a05c';
      ctx.fillRect(px + ((x * 7) % 36) + 2, py + ((y * 3) % 36) + 2, 2, 1);
    }
    if (h < 10) {
      ctx.fillStyle = '#c1ac68';
      ctx.fillRect(px + ((x * 11) % 36) + 2, py + ((y * 13) % 36) + 2, 3, 2);
    }
  }
}

function shade(ctx, px, py, len) {
  ctx.fillStyle = 'rgba(30,20,10,0.18)';
  ctx.fillRect(px + 6, py + 28, len, 10);
}

function drawFence(ctx, px, py) {
  ctx.fillStyle = '#6d5230';
  ctx.fillRect(px + 6, py + 10, 28, 5);
  ctx.fillRect(px + 6, py + 24, 28, 5);
  ctx.fillStyle = '#7d5f38';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(px + 8 + i * 6, py + 6, 4, 26);
  }
  ctx.fillStyle = '#5a4122';
  ctx.fillRect(px + 6, py + 12, 28, 1);
  ctx.fillRect(px + 6, py + 26, 28, 1);
}

function drawWater(ctx, px, py, t, x, y) {
  ctx.fillStyle = '#4a90c2';
  ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
  ctx.fillStyle = '#5aa8d8';
  ctx.fillRect(px + 5, py + 5 + ((y + Math.floor(t / 400)) % 2), 12, 2);
  ctx.fillRect(px + 24, py + 20 + ((y + 1 + Math.floor(t / 400)) % 2), 9, 2);
  ctx.fillStyle = '#2f6f9c';
  ctx.fillRect(px + 4, py + 32, TILE - 8, 4);
}

function drawFlower(ctx, px, py, t, x, y) {
  const sway = Math.round(Math.sin(t / 600 + x + y) * 1);
  const petals = ['#e86a92', '#f2c14e', '#8fc8e8'][(x + y) % 3];
  const cx = px + 18 + sway;
  ctx.fillStyle = '#3e6b2c';
  ctx.fillRect(cx, py + 26, 2, 8);
  ctx.fillStyle = petals;
  ctx.fillRect(cx - 5, py + 16, 4, 4);
  ctx.fillRect(cx + 3, py + 16, 4, 4);
  ctx.fillRect(cx - 1, py + 12, 4, 4);
  ctx.fillRect(cx - 1, py + 20, 4, 4);
  ctx.fillStyle = '#c8be7a';
  ctx.fillRect(cx, py + 15, 3, 3);
}

function drawDoor(ctx, px, py, isGate, open) {
  // stone frame
  ctx.fillStyle = '#9a8a6a';
  ctx.fillRect(px + 6, py + 8, 28, 28);
  ctx.fillStyle = '#7c6c50';
  ctx.fillRect(px + 6, py + 8, 28, 4);
  if (isGate) {
    // gate bars
    ctx.fillStyle = '#4a3320';
    ctx.fillRect(px + 10, py + 12, 20, 24);
    ctx.fillStyle = open ? '#6b4a2c' : '#4a3320';
    ctx.fillRect(px + 14, py + 12, 3, 24);
    ctx.fillRect(px + 23, py + 12, 3, 24);
    ctx.fillStyle = open ? '#8fd0e8' : '#3a2c1c';
    ctx.fillRect(px + 18, py + 20, 4, 8);
    if (!open) {
      // shimmering seal jewel
      const pulse = Math.round(Math.sin(performance.now() / 300) * 3) + 4;
      ctx.fillStyle = '#e85c6a';
      ctx.fillRect(px + 17, py + 14 + (2 - pulse / 8), 6, 6);
    }
  } else {
    // cottage door
    ctx.fillStyle = '#5a3d22';
    ctx.fillRect(px + 12, py + 12, 16, 24);
    ctx.fillStyle = '#3d2812';
    ctx.fillRect(px + 14, py + 14, 12, 22);
    ctx.fillStyle = '#e8c06a';
    ctx.fillRect(px + 23, py + 22, 3, 3);
  }
}