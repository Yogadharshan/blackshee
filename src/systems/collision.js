import { TILE, MAP_W, MAP_H } from '../data/world.js';

export function tileAt(tiles, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return '#';
  return tiles[ty][tx];
}

export function isSolid(ch) {
  return ch === '#' || ch === 'B' || ch === 'W' || ch === 'F' || ch === 'R' || ch === 'S';
}

// True if the AABB [x,y,w,h] overlaps any solid tile.
export function rectBlocked(tiles, x, y, w, h) {
  const x0 = Math.floor(x / TILE);
  const x1 = Math.floor((x + w - 0.01) / TILE);
  const y0 = Math.floor(y / TILE);
  const y1 = Math.floor((y + h - 0.01) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (isSolid(tileAt(tiles, tx, ty))) return true;
    }
  }
  return false;
}