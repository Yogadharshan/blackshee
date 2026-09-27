import { DIALOGUE } from '../data/dialogue.js';
import { SIDEQUESTS } from '../data/quests.js';
import { advanceStory, choice } from './story.js';
import { MEMORY_BEATS } from '../data/story_beats.js';

// All progress lives here. NPCs and hotspots read flags from this.
export function createQuestState() {
  return {
    memories: 0,
    required: 5,
    collected: {},       // memory ids picked up
    // Per-flower pick-up state (ids flw1/flw2/flw3). Presentation-driven: lets
    // the world stop drawing a flower once it is picked. Additive default so
    // old saves merge in cleanly via applySave (SAVE_VERSION unchanged).
    flowersPicked: {},
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
    secret: { discovered: false, sixth: false, treePokes: 0, sheepTalk: 0 },
    // Narrative understanding, kept separate from collection progress
    // (memories/collected). Advanced only by named story beats via
    // systems/story.js; never derived from the Memory count.
    // fragments: distinct NPC recollections heard (systems/story.js).
    story: { stage: 0, twinRevealed: false, choices: {}, fragments: {} },
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
    case 'rockSheep': {
      // Phase 6 callback: the hand-in is the "later" after the offer-time choice.
      const rockPick = choice({ q }, 'rock');
      if (q.rockGiven) return DIALOGUE.rock_after;
      if (q.hasRock) {
        q.rockGiven = true;
        q.side.rock = 'done';
        if (rockPick === 'respect') return DIALOGUE.rock_after.concat(DIALOGUE.rock_callback_respect);
        if (rockPick === 'practical') return DIALOGUE.rock_after.concat(DIALOGUE.rock_callback_practical);
        return DIALOGUE.rock_after;
      }
      q.side.rock = 'active';
      return DIALOGUE.rock;
    }
    case 'farmSheep': {
      // Phase 6 callback: finding Bo is the "later" after the offer-time choice.
      const friendPick = choice({ q }, 'friend');
      if (q.boFound) {
        q.side.friend = 'done';
        if (friendPick === 'search') return DIALOGUE.farm_after.concat(DIALOGUE.farm_callback_search);
        if (friendPick === 'question') return DIALOGUE.farm_after.concat(DIALOGUE.farm_callback_question);
        return DIALOGUE.farm_after;
      }
      q.side.friend = 'active';
      return DIALOGUE.farm;
    }
    case 'suspicious':
      return q.secret.discovered ? DIALOGUE.suspicious : DIALOGUE.suspicious_secret;
    case 'sixth': {
      q.secret.sheepTalk++;
      if (q.secret.sixth) return DIALOGUE.sixth_after;
      if (q.secret.sheepTalk >= 5) { q.secret.sixth = true; return DIALOGUE.sixth_grant; }
      const lines = [DIALOGUE.sixth1, DIALOGUE.sixth2, DIALOGUE.sixth3, DIALOGUE.sixth4, DIALOGUE.sixth_grant];
      return lines[Math.min(q.secret.sheepTalk - 1, 3)];
    }
    default:
      return DIALOGUE[npcId] || [['', '...baa.']];
  }
}

// Reward granted right after a "done" dialogue closes. Won't double-grant.
// The Red Flower Memory arrives here (not via a hotspot), so the same story
// beats are fired as for a collected Memory.
export function rewardFor(npcId, game) {
  const q = game.q;
  if (npcId === 'baabara' && q.flowersGiven && !q.collected['flower']) {
    q.collected['flower'] = true;
    q.memories = Math.min(q.required, q.memories + 1);
    advanceStory(game, 'STAGE_1_FIRST_MEMORY');
    if (MEMORY_BEATS.flower) advanceStory(game, MEMORY_BEATS.flower);
  }
}