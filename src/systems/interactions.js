// Find the closest thing the player can talk to or pick up.
const RANGE = 72; // px from player center

export function nearestInteractable(game) {
  const p = game.player;
  let best = null;
  let bestD = RANGE;
  for (const n of game.world.npcs) {
    const d = Math.hypot(n.px + 20 - p.cx, n.py + 20 - p.cy);
    if (d < bestD) { bestD = d; best = { type: 'npc', ref: n }; }
  }
  for (const h of game.world.hotspots) {
    const d = Math.hypot(h.px + 20 - p.cx, h.py + 20 - p.cy);
    if (d < bestD) { bestD = d; best = { type: 'hotspot', ref: h }; }
  }
  return best;
}