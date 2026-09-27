// First-person pseudo-3D view: a tiny raycaster over the existing 2D tile grid.
// Renders to a low-res internal canvas (320x180) and blits up — intentionally retro.
import { TILE } from '../data/world.js';
import { sprites, memorySprite } from '../systems/sprites.js';

const W = 320;
const H = 180;
const COLS = 160;
const FOV = 0.66;
// Tiles the raycaster treats as walls. 'S' (secret tree) is collision-solid in
// LEGEND and must also be a wall here, or it renders as an invisible blocker.
const SOLID = new Set(['#', 'B', 'F', 'R', 'W', 'S']);

// True if a tile blocks the first-person view. Exported for tests.
export function isWallTile(ch) {
  return SOLID.has(ch);
}

const WALLS = {
  '#': ['#3d5a2a', '#335024'], // tree
  'S': ['#3d5a2a', '#335024'], // secret tree (looks like a tree; discovery is by dialogue)
  'B': ['#b98a5e', '#a57a50'], // building
  'F': ['#8a6a3a', '#7c5c30'], // fence
  'R': ['#8a8a8a', '#7c7c84'], // rock
  'W': ['#3f7fb0', '#35709c'], // water
};

let off = null; // internal render target

export function renderFP(ctx, game, others) {
  if (typeof document === 'undefined') return;
  if (!off) {
    off = document.createElement('canvas');
    off.width = W;
    off.height = H;
  }
  const g = off.getContext('2d');
  g.clearRect(0, 0, W, H);

  const tiles = game.world.tiles;
  const p = game.player;
  const posX = p.x / TILE + 0.5;
  const posY = p.y / TILE + 0.5;
  let dirX = p.dir.x, dirY = p.dir.y;
  const len = Math.hypot(dirX, dirY) || 1;
  dirX /= len; dirY /= len;
  const planeX = -dirY * FOV, planeY = dirX * FOV;

  // ceiling + floor (flat, two retro bands)
  g.fillStyle = '#20242c';
  g.fillRect(0, 0, W, H / 2);
  g.fillStyle = '#5a6b3e';
  g.fillRect(0, H / 2, W, H / 2);

  const zBuffer = new Float32Array(COLS);

  for (let x = 0; x < COLS; x++) {
    const cameraX = (2 * x) / COLS - 1;
    const rdx = dirX + planeX * cameraX;
    const rdy = dirY + planeY * cameraX;
    let mapX = Math.floor(posX), mapY = Math.floor(posY);
    const ddx = Math.abs(1 / (rdx === 0 ? 1e-9 : rdx));
    const ddy = Math.abs(1 / (rdy === 0 ? 1e-9 : rdy));
    let stepX, stepY, sideX, sideY;
    if (rdx < 0) { stepX = -1; sideX = (posX - mapX) * ddx; } else { stepX = 1; sideX = (mapX + 1 - posX) * ddx; }
    if (rdy < 0) { stepY = -1; sideY = (posY - mapY) * ddy; } else { stepY = 1; sideY = (mapY + 1 - posY) * ddy; }

    let hit = 0, side = 0;
    for (let i = 0; i < 64; i++) {
      if (sideX < sideY) { sideX += ddx; mapX += stepX; side = 0; } else { sideY += ddy; mapY += stepY; side = 1; }
      const ch = tileSafe(tiles, mapX, mapY);
      if (SOLID.has(ch)) { hit = ch; break; }
    }
    let perp = side === 0 ? sideX - ddx : sideY - ddy;
    if (perp <= 0.01) perp = 0.01;
    zBuffer[x] = perp;

    const lineH = Math.round(H / perp);
    const top = Math.round(H / 2 - lineH / 2);
    const base = WALLS[hit] || WALLS['#'];
    const shade = side === 1 ? 0.78 : 1;
    // fake texture: parity checkerboard by block edge
    const tex = (mapX + mapY) % 2 === 0 ? base[0] : base[1];
    g.fillStyle = shadeColor(tex, shade);
    g.fillRect(x * 2, top, 2, lineH);
    // wall bottom edge shading
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(x * 2, top + lineH - 2, 2, 2);
  }

  // billboards: NPCs, memories, and the other player
  const actors = [
    ...game.world.npcs.map((n) => ({ kind: 'npc', ax: n.px / TILE + 0.5, ay: n.py / TILE + 0.5 })),
    ...game.world.hotspots.filter((h) => h.kind === 'memory' && !game.q.collected[h.item]).map((h) => ({ kind: 'mem', item: h.item, ax: h.px / TILE + 0.5, ay: h.py / TILE + 0.5 })),
  ];
  for (const o of others.values()) {
    if (o.id === game.myId) continue;
    actors.push({ kind: 'player', ax: o.x / TILE + 0.5, ay: o.y / TILE + 0.5 });
  }
  drawBillboards(g, actors, posX, posY, dirX, dirY, planeX, planeY, zBuffer);

  // mount foreground (the Mount Sheep's head at the bottom)
  drawMount(g);

  // blit low-res up to the full canvas, keep hard pixels
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, 0, 0, W, H, 0, 0, 960, 640);
}

function drawBillboards(g, actors, posX, posY, dirX, dirY, planeX, planeY, zBuffer) {
  const invDet = 1 / (planeX * dirY - dirX * planeY);
  for (const a of actors) {
    const relX = a.ax - posX;
    const relY = a.ay - posY;
    const tX = invDet * (dirY * relX - dirX * relY);
    const tY = invDet * (-planeY * relX + planeX * relY);
    if (tY <= 0.15) continue; // behind camera
    const screenX = Math.round((W / 2) * (1 + tX / tY));
    const size = Math.min(H * 0.75, Math.round((14 / tY) * 1.1));

    // z-buffer clip: skip if wall closer in every covered column
    const start = Math.max(0, screenX - size / 2);
    const end = Math.min(COLS, screenX + size / 2);
    let occluded = true;
    const col = Math.floor(screenX / 2);
    if (col >= 0 && col < COLS && tY < zBuffer[col]) occluded = false;
    if (occluded && size < 40) continue;

    if (a.kind === 'mem' && memorySprite(a.item)) {
      const pxb = size / 2;
      g.fillStyle = 'rgba(242,193,78,0.35)';
      const bob = Math.round(Math.sin(performance.now() / 300) * 2);
      g.beginPath();
      g.moveTo(screenX, H / 2 - pxb + bob);
      g.lineTo(screenX + pxb, H / 2 + bob);
      g.lineTo(screenX, H / 2 + pxb + bob);
      g.lineTo(screenX - pxb, H / 2 + bob);
      g.closePath();
      g.fill();
      g.fillStyle = '#fff2c9';
      g.fillRect(screenX - 2, H / 2 - 2 + bob, 4, 4);
    } else {
      // NPCs are white sheep; the other co-op player is black, like you.
      const sheep = (a.kind === 'player' ? sprites().sheepBlack : sprites().sheepWhite)[0];
      if (sheep) {
        const sw = Math.round(size * 1.1);
        const sh = Math.round(size * 1.1);
        g.drawImage(sheep, Math.round(screenX - sw / 2), Math.round(H / 2 - sh / 2), sw, sh);
      }
    }
  }
}

function drawMount(g) {
  const sheep = sprites().sheepWhite[0];
  if (!sheep) return;
  const s = 2.6;
  const w = Math.round(sheep.width * s);
  const h = Math.round(sheep.height * s);
  // only the head/wool pokes up over the bottom edge
  g.drawImage(sheep, Math.round(W / 2 - w / 2), H - h + Math.round(h * 0.55), w, h);
  // ears visible
  g.fillStyle = '#e8e4d2';
  g.fillRect(Math.round(W / 2 - w / 2) - 4, H - Math.round(h * 0.2), 5, 10);
  g.fillRect(Math.round(W / 2 + w / 2) - 1, H - Math.round(h * 0.2), 5, 10);
}

function tileSafe(tiles, x, y) {
  if (x < 0 || y < 0 || y >= tiles.length) return '#';
  const row = tiles[y];
  if (x >= row.length) return '#';
  return row[x];
}

function shadeColor(hex, f) {
  const r = parseInt(hex.slice(1, 3), 16);
  const gg = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * f)},${Math.round(gg * f)},${Math.round(b * f)})`;
}