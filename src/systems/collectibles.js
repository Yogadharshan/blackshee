import { DIALOGUE } from '../data/dialogue.js';
import { rewardFor } from './quests.js';

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
      game.say(dialogLines(hs.dialog));
      break;
    }
    case 'flower': {
      if (q.flowersGiven) return;
      q.flowers++;
      game.say(dialogLines('flower_pickup'));
      break;
    }
    case 'rock': {
      if (q.hasRock) return;
      q.hasRock = true;
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
        game.say(dialogLines('shrine_altar'), () => {
          q.finished = true;
          rewardFor('altar', q);
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
      }
      break;
    }
  }
}