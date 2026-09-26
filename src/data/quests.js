// Main quest + sidequest definitions. State lives in the Game, not here.
export const MAIN = {
  id: 'memories',
  title: 'The Five Memories',
  objective: 'Find the 5 Memories hidden around the world.',
  required: 5,
};

export const SIDEQUESTS = {
  flowers: {
    id: 'flowers',
    title: 'Three Flowers for Baaabara',
    giver: 'baabara',
    type: 'collect',
    item: 'flower',
    target: 3,
  },
  friend: {
    id: 'friend',
    title: 'Bo the Missing Friend',
    giver: 'farmSheep',
    type: 'talk',
    target: 'bo',
  },
  rock: {
    id: 'rock',
    title: 'The Extremely Important Rock',
    giver: 'rockSheep',
    type: 'fetch',
    item: 'rock',
  },
};