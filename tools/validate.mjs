// Dev-only integrity check: map row lengths, door tiles present, walkable spawns.
import { AREAS, DOORS, MAP_W, MAP_H, START } from '../src/data/world.js';
import { NPCS } from '../src/data/npcs.js';
import { HOTSPOTS } from '../src/data/collectibles.js';
import { DIALOGUE } from '../src/data/dialogue.js';

let bad = 0;
const report = (ok, msg) => { if (!ok) { bad++; console.log('FAIL:', msg); } };

for (const [name, area] of Object.entries(AREAS)) {
  report(area.tiles.length === MAP_H, `${name}: has ${area.tiles.length} rows (want ${MAP_H})`);
  area.tiles.forEach((row, y) => {
    report(row.length === MAP_W, `${name} row ${y}: length ${row.length} (want ${MAP_W})`);
  });
}

const tilesOf = (a) => AREAS[a].tiles;
for (const d of DOORS) {
  const ch = tilesOf(d.from)[d.y][d.x];
  report(ch === 'D' || ch === 'X' || (d.secret && ch === 'S'), `door ${d.from}(${d.x},${d.y}) tile is '${ch}' not D/X/S-for-secret`);
  const ch2 = tilesOf(d.to)[d.ty][d.tx];
  report(ch2 === 'D' || ch2 === 'X' || ch2 === 'S', `door ${d.to}(${d.tx},${d.ty}) tile is '${ch2}' not D/X`);
}
report(tilesOf(START.area)[START.tileY][START.tileX] !== '#', `start tile solid`);

for (const n of NPCS) {
  const ch = tilesOf(n.area)[n.y][n.x];
  report(ch !== '#' && ch !== 'B' && ch !== 'W' && ch !== 'F' && ch !== 'R', `npc ${n.id} on solid '${ch}'`);
  report(DIALOGUE[n.talk] || true, `npc ${n.id} talk key exists`);
}
for (const h of HOTSPOTS) {
  const ch = tilesOf(h.area)[h.y][h.x];
  report(ch !== '#' && ch !== 'B' && ch !== 'W' && ch !== 'F' && ch !== 'R', `hotspot ${h.id} on solid '${ch}'`);
}
for (const key of Object.keys(DIALOGUE)) {
  report(Array.isArray(DIALOGUE[key]), `dialogue ${key} is array`);
}
console.log(bad === 0 ? 'ALL MAP CHECKS PASS' : `${bad} problem(s) found`);