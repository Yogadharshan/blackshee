// NPC-specific scripted answers for the guided intents, tiered by Baa lore
// stage. Content data only — informational wording, never game state.
//
// Selection picks the highest tier whose `stage` <= the context's baaStage.
// baaStage is derived in npc_context.js; answers never compute it and never
// see raw game state, so scripted replies cannot bypass fact gating.

export const NPC_ANSWERS = Object.freeze({
  elder: {
    WHO_IS_BAA: [
      { stage: 0, text: 'Baa? ...That name is familiar the way a dream is. I cannot hold onto it.' },
      { stage: 1, text: 'Baa... there was someone by that name, long ago. The rest of it is fog.' },
      { stage: 2, text: 'Baa lived here once. A black sheep, like the two of you.' },
      { stage: 3, text: 'Baa wandered this valley, built things, and helped the herd. An ordinary life, not a legend.' },
      { stage: 5, text: "Baa was your grandparent. You are Baa's grandchildren, and I remember now." },
    ],
    WHAT_DO_YOU_REMEMBER: [
      { stage: 0, text: 'Less than I should. That is the trouble with this whole valley.' },
      { stage: 1, text: 'A warmth, and not the face that went with it. Strange, is it not.' },
      { stage: 2, text: 'I remember that Baa existed. After that the memory thins out.' },
      { stage: 3, text: 'I remember Baa mending a fence for no reward. Small, kind things, mostly.' },
      { stage: 4, text: 'I remember wool like yours. I never understood why it mattered.' },
    ],
    TELL_ME_ABOUT_THIS_PLACE: [
      { stage: 0, text: 'A quiet valley that pretends to be perfectly ordinary. Do not believe it.' },
      { stage: 2, text: 'The Old Shrine has stood silent for years. It waits for five Memories.' },
      { stage: 4, text: 'This is a valley that forgets. It is, honestly, very good at it.' },
    ],
    WHAT_SHOULD_I_DO: [
      { stage: 0, text: 'Find the five Memories: the Old Bell, the Red Flower, the Wooden Toy, the Old Ribbon, the Photograph.' },
      { stage: 4, text: 'Carry the Memories to the Old Shrine. The seal is nearly ready to break.' },
      { stage: 5, text: 'You have done it. Rest now. The valley remembers what it lost.' },
    ],
    WHY_TWO_BLACK_SHEEP: [
      { stage: 0, text: 'Two of you? ...That is new. I have no answer, only a feeling.' },
      { stage: 2, text: 'A black sheep came to this valley once before. Now there are two. Curious.' },
      { stage: 4, text: 'Your wool is familiar to me. I cannot say why. Not yet.' },
      { stage: 5, text: "Because you are Baa's grandchildren. That is why." },
    ],
  },
  mountKeeper: {
    WHAT_SHOULD_I_DO: [
      { stage: 0, text: 'The Elder hands out quests. Get one, then ride. Press M once you have a mount.' },
    ],
    TELL_ME_ABOUT_THIS_PLACE: [
      { stage: 0, text: 'A working farm. We raise Mount Sheep. Please do not think about it further.' },
      { stage: 3, text: 'They say Baa rode something that was also a sheep. I take no position on this.' },
    ],
    WHY_TWO_BLACK_SHEEP: [
      { stage: 0, text: 'Two black sheep. Unusual stock. I will not be discussing genetics.' },
      { stage: 4, text: 'You sit a mount the way the old stories say Baa did. Make of that what you will.' },
    ],
  },
  baabara: {
    WHAT_SHOULD_I_DO: [
      { stage: 0, text: 'Bring me three flowers. Not four. Not two. THREE. It is a matter of destiny.' },
    ],
    TELL_ME_ABOUT_THIS_PLACE: [
      { stage: 0, text: 'A valley of sheep with no taste. I am the only one who suffers here.' },
      { stage: 2, text: 'This place forgets beautiful things. That is why I keep flowers.' },
    ],
    WHAT_DO_YOU_REMEMBER: [
      { stage: 0, text: 'I remember every flower I have ever lost. That is the entire list.' },
      { stage: 1, text: 'Someone used to bring flowers. I cannot picture who, and it makes me furious.' },
      { stage: 2, text: 'Baa liked red flowers. I think. Or I do. I refuse to check.' },
    ],
  },
});

// Highest-tier answer at or below the given stage. Returns null when the NPC
// has nothing for that intent (the provider then uses its safe fallback).
export function selectAnswer(npcId, intent, stage) {
  const tiers = (NPC_ANSWERS[npcId] || {})[intent];
  if (!tiers || !tiers.length) return null;
  let best = null;
  for (const t of tiers) {
    if (t.stage <= stage && (!best || t.stage >= best.stage)) best = t;
  }
  return best ? best.text : null;
}
