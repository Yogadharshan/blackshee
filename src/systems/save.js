// Tiny localStorage save for single-player progress.
//
// Restores existing state only (Memories, quest flags, area/position, mount) —
// it introduces no new progression. Every call is guarded so environments
// without localStorage (Node, private mode, disabled storage) are a safe no-op
// and can never break the game.
import { createQuestState } from './quests.js';

const KEY = 'blackshee.save.v1';
const VERSION = 1;
export const SAVE_KEY = KEY;

function storage() {
  try {
    if (typeof localStorage === 'undefined' || !localStorage) return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function hasSave() {
  const s = storage();
  if (!s) return false;
  try { return !!s.getItem(KEY); } catch { return false; }
}

export function loadSave() {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== VERSION || !data.q) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(game) {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(KEY, JSON.stringify({
      v: VERSION,
      t: Date.now(),
      area: game.world.area,
      x: Math.round(game.player.x),
      y: Math.round(game.player.y),
      mounted: !!game.mounted,
      q: game.q,
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  const s = storage();
  if (!s) return;
  try { s.removeItem(KEY); } catch { /* ignore */ }
}

// Restore a save onto a game in place. Merges over a fresh quest state so a
// save from an older build never yields missing fields.
export function applySave(game, data) {
  if (!game || !data || !data.q) return false;
  try {
    const base = createQuestState();
    game.q = {
      ...base,
      ...data.q,
      secret: { ...base.secret, ...(data.q.secret || {}) },
      side: { ...base.side, ...(data.q.side || {}) },
      collected: { ...(data.q.collected || {}) },
      // Additive: an older save without q.story loads with the base story
      // (stage 0). No Memory-derived floor — narrative state is its own thing.
      story: {
        ...base.story,
        ...(data.q.story || {}),
        choices: { ...base.story.choices, ...((data.q.story && data.q.story.choices) || {}) },
      },
    };
    if (data.area) game.world.setArea(data.area);
    if (typeof data.x === 'number') game.player.x = data.x;
    if (typeof data.y === 'number') game.player.y = data.y;
    game.mounted = !!data.mounted && game.q.mountOwned;
    game.player.speed = game.mounted ? 300 : 170;
    game.player.moving = false;
    // A saved position on a portal tile must not fire on the first frame.
    game.portalArmed = false;
    game.portalLockUntil = 0;
    if (game.ask) { game.ask.active = false; game.ask.answer = null; game.ask.thinking = false; }
    return true;
  } catch {
    return false;
  }
}
