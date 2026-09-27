import { DIALOGUE } from '../data/dialogue.js';
import { rewardFor } from './quests.js';
import { sfx } from './sfx.js';
import { advanceStory, hasChoice } from './story.js';
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
      // First Memory collected (0 -> 1): latch a transient burst pulse for
      // render(). Presentation only, never persisted.
      if (q.memories === 1) {
        game.memoryBurst = { px: hs.px + 20, py: hs.py + 20, at: performance.now() };
      }
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
      q.flowersPicked[hs.id] = true;
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
        // The Baa sequence: recognition first, then the aftermath reveal. The
        // flag fires once at the very end, through advanceStory only. The secret
        // Sixth Memory beat still plays first when held (unchanged content).
        const finish = () => {
          const six = q.secret.sixth ? dialogLines('shrine_altar_six') : [];
          const enc = dialogLines('baa_encounter');
          const rev = dialogLines('baa_reveal');
          // Phase 6C staging (presentation only, transient). The reveal begins
          // right after the encounter lines, regardless of the Sixth preface.
          game.stageBaa = true;
          game.baaStageAt = performance.now();
          game.baaRevealAt = six.length + enc.length;
          game.say(six.concat(enc, rev), () => {
            game.stageBaa = false;
            game.baaRevealAt = -1;
            advanceStory(game, 'TWIN_REVEALED');
            q.finished = true;
            rewardFor('altar', game);
            game.mode = 'ending';
          });
        };
        // Phase 6: the Photograph choice sits immediately before the Baa
        // sequence. It never reveals the twin and both replies proceed
        // unchanged, so the main story stays convergent.
        if (!hasChoice(game, 'memory') && typeof game.offerChoice === 'function') {
          game.offerChoice('memory', finish);
        } else {
          finish();
        }
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
        game.secretPoke = true; // latch for the co-op relay (fires on every poke)
        if (q.secret.treePokes >= 3) {
          // Single-player path to the hidden doorway: the third poke reveals it
          // here, offline and in co-op alike. (The co-op relay also sets it via
          // syncPlayers/shared.discovered — this branch is the solo route.)
          q.secret.discovered = true;
          game.say(dialogLines('tree_reveal'));
        } else {
          game.say(dialogLines('tree' + q.secret.treePokes));
        }
      }
      break;
    }
  }
}