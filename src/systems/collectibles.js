import { DIALOGUE } from '../data/dialogue.js';
import { rewardFor } from './quests.js';
import { sfx } from './sfx.js';
import { advanceStory } from './story.js';
import { MEMORY_BEATS } from '../data/story_beats.js';

export function dialogLines(key) {
  return DIALOGUE[key] || [['', '...baa?']];
}

// A hotspot was interacted with. Mutates quest state and starts dialogue.
export function handleHotspot(game, hs) {
  const q = game.q;
  switch (hs.kind) {
    case 'memory': {
      if (q.collected[hs.item]) return;
      q.collected[hs.item] = true;
      q.memories = Math.min(q.required, q.memories + 1);
      // The first Memory (any item) is the one stage-1 beat defined by state;
      // later authored Memories advance their own beat (see MEMORY_BEATS).
      advanceStory(game, 'STAGE_1_FIRST_MEMORY');
      if (MEMORY_BEATS[hs.item]) advanceStory(game, MEMORY_BEATS[hs.item]);
      sfx.pickup();
      game.say(dialogLines(hs.dialog));
      break;
    }
    case 'flower': {
      if (q.flowersGiven) return;
      q.flowers++;
      sfx.pickup();
      game.say(dialogLines('flower_pickup'));
      break;
    }
    case 'rock': {
      if (q.hasRock) return;
      q.hasRock = true;
      sfx.pickup();
      game.say(dialogLines('rock_pickup'));
      break;
    }
    case 'bo': {
      if (q.boFound) return;
      q.boFound = true;
      game.say(dialogLines('bo'));
      break;
    }
    case 'altar': {
      if (q.memories >= q.required) {
        const lines = q.secret.sixth ? dialogLines('shrine_altar_six') : dialogLines('shrine_altar');
        game.say(lines, () => {
          q.finished = true;
          rewardFor('altar', game);
          game.mode = 'ending';
        });
      } else {
        game.say(dialogLines('gate_sealed'));
      }
      break;
    }
    case 'secret': {
      if (hs.id === 'sign') {
        q.signPokes++;
        const poke = Math.min(q.signPokes, 5);
        game.say(dialogLines('sign' + poke));
      } else if (hs.id === 'hidden') {
        if (q.hiddenFound) return;
        q.hiddenFound = true;
        game.say(dialogLines('hidden'));
      } else if (hs.id === 'secretTree') {
        if (q.secret.discovered) {
          game.say(dialogLines('tree_open'));
          return;
        }
        q.secret.treePokes++;
        const poke = Math.min(q.secret.treePokes, 3);
        game.say(dialogLines('tree' + poke));
        game.secretPoke = true; // latch for the co-op relay
      }
      break;
    }
  }
}