// Interactable world objects: memories, flowers, quest items, the altar.
// kind: memory | flower | rock | altar | secret
export const HOTSPOTS = [
  { id: 'mem_bell',   kind: 'memory', area: 'village', x: 19, y: 7,  item: 'bell',  dialog: 'memory_bell' },
  { id: 'mem_toy',    kind: 'memory', area: 'meadow',  x: 21, y: 12, item: 'toy',   dialog: 'memory_toy' },
  { id: 'mem_ribbon', kind: 'memory', area: 'forest',  x: 9,  y: 9,  item: 'ribbon', dialog: 'memory_ribbon' },
  { id: 'mem_photo',  kind: 'memory', area: 'meadow',  x: 8,  y: 4,  item: 'photo', dialog: 'memory_photo' },
  { id: 'flw1',       kind: 'flower', area: 'village', x: 10, y: 5 },
  { id: 'flw2',       kind: 'flower', area: 'meadow',  x: 6,  y: 6 },
  { id: 'flw3',       kind: 'flower', area: 'farm',    x: 16, y: 5 },
  { id: 'rock1',      kind: 'rock',   area: 'village', x: 17, y: 11 },
  { id: 'altar',      kind: 'altar',  area: 'shrine',  x: 12, y: 7 },
  { id: 'bo',         kind: 'bo',     area: 'forest',  x: 2,  y: 6 },
  { id: 'sign',       kind: 'secret', area: 'village', x: 7,  y: 3 },
  { id: 'hidden',     kind: 'secret', area: 'meadow',  x: 21, y: 4 },
];