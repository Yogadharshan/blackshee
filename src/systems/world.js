import { AREAS, TILE, LEGEND, DOORS } from '../data/world.js';
import { NPCS } from '../data/npcs.js';
import { HOTSPOTS } from '../data/collectibles.js';

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

  draw(ctx) {
    const { tiles } = this;
    for (let y = 0; y < tiles.length; y++) {
      for (let x = 0; x < tiles[y].length; x++) {
        const ch = tiles[y][x];
        const info = LEGEND[ch] || LEGEND['.'];
        ctx.fillStyle = info.color;
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        if (info.draw === 'tree') {
          ctx.fillStyle = '#2f4620';
          ctx.beginPath();
          ctx.arc(x * TILE + 20, y * TILE + 22, 15, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#4a6b2f';
          ctx.beginPath();
          ctx.arc(x * TILE + 16, y * TILE + 18, 11, 0, Math.PI * 2);
          ctx.fill();
        } else if (info.draw === 'building') {
          ctx.fillStyle = '#8a5a33';
          ctx.fillRect(x * TILE + 2, y * TILE + 6, TILE - 4, TILE - 6);
          ctx.fillStyle = '#5c3a20';
          ctx.fillRect(x * TILE + 4, y * TILE + 8, 10, 10);
          ctx.fillRect(x * TILE + 26, y * TILE + 8, 10, 10);
          ctx.fillStyle = '#c9a06a';
          ctx.fillRect(x * TILE + 17, y * TILE + 14, 8, 12);
        } else if (info.draw === 'fence') {
          ctx.fillStyle = '#6d5230';
          ctx.fillRect(x * TILE + 10, y * TILE + 8, 20, 6);
          ctx.fillRect(x * TILE + 10, y * TILE + 22, 20, 6);
          for (let i = 0; i < 4; i++) {
            ctx.fillRect(x * TILE + 10 + i * 5, y * TILE + 4, 4, 26);
          }
        } else if (info.draw === 'water') {
          ctx.fillStyle = '#6db3e0';
          ctx.fillRect(x * TILE + 4, y * TILE + 4, TILE - 8, TILE - 8);
        } else if (info.draw === 'flowers') {
          ctx.fillStyle = '#e86a92';
          ctx.beginPath();
          ctx.arc(x * TILE + 14, y * TILE + 16, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#f2c14e';
          ctx.beginPath();
          ctx.arc(x * TILE + 24, y * TILE + 26, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#bfe5f0';
          ctx.beginPath();
          ctx.arc(x * TILE + 28, y * TILE + 12, 3, 0, Math.PI * 2);
          ctx.fill();
        } else if (info.draw === 'rock') {
          ctx.fillStyle = '#9a9a9a';
          ctx.beginPath();
          ctx.arc(x * TILE + 20, y * TILE + 24, 12, 0, Math.PI * 2);
          ctx.fill();
        } else if (info.draw === 'door' || info.draw === 'gate') {
          ctx.fillStyle = '#a8844c';
          ctx.fillRect(x * TILE + 10, y * TILE + 14, 20, 22);
          ctx.fillStyle = '#4a3320';
          ctx.fillRect(x * TILE + 12, y * TILE + 16, 16, 18);
        }
      }
    }
  }
}