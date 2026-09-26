import { DIALOGUE } from '../data/dialogue.js';
import { SIDEQUESTS } from '../data/quests.js';

// All progress lives here. NPCs and hotspots read flags from this.
export function createQuestState() {
  return {
    memories: 0,
    required: 5,
    collected: {},       // memory ids picked up
    flowers: 0,          // flowers handed... no: flowers carried
    flowersGiven: false,
    hasRock: false,
    rockGiven: false,
    boFound: false,
    signPokes: 0,
    hiddenFound: false,
    side: { flowers: 'idle', friend: 'idle', rock: 'idle' },
    sealAnnounced: false,
    elderTalked: false,
    mountOwned: false,
  };
}

export const SIDE = SIDEQUESTS;

// Pick the right dialogue lines for an NPC given current progress.
export function talkFor(npcId, q) {
  switch (npcId) {
    case 'elder': {
      q.elderTalked = true;
      return q.memories >= q.required ? DIALOGUE.elder_after : DIALOGUE.elder;
    }
    case 'mountKeeper':
      if (q.mountOwned) return DIALOGUE.mountkeeper_after;
      if (q.elderTalked) {
        q.mountOwned = true;
        return DIALOGUE.mountkeeper_gift;
      }
      return DIALOGUE.mountkeeper;
    case 'baabara':
      if (q.flowersGiven) return DIALOGUE.baabara_after;
      if (q.side.flowers === 'done') return DIALOGUE.baabara_after;
      if (q.flowers >= 3) {
        q.flowersGiven = true;
        q.side.flowers = 'done';
        return DIALOGUE.baabara_done;
      }
      if (q.side.flowers === 'active') return DIALOGUE.baabara_need;
      q.side.flowers = 'active';
      return DIALOGUE.baabara;
    case 'rockSheep':
      if (q.rockGiven) return DIALOGUE.rock_after;
      if (q.hasRock) {
        q.rockGiven = true;
        q.side.rock = 'done';
        return DIALOGUE.rock_after;
      }
      q.side.rock = 'active';
      return DIALOGUE.rock;
    case 'farmSheep':
      if (q.boFound) { q.side.friend = 'done'; return DIALOGUE.farm_after; }
      q.side.friend = 'active';
      return DIALOGUE.farm;
    default:
      return DIALOGUE[npcId] || [['', '...baa.']];
  }
}

// Reward granted right after a "done" dialogue closes. Won't double-grant.
export function rewardFor(npcId, q) {
  if (npcId === 'baabara' && q.flowersGiven && !q.collected['flower']) {
    q.collected['flower'] = true;
    q.memories = Math.min(q.required, q.memories + 1);
  }
}