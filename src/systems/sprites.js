// Pixel-art sprites drawn at low resolution and scaled up with crisp edges.
// No image assets, no framework. Everything is lazy so node smoke tests still run.

const HAS_DOM = typeof document !== 'undefined';

// Build a sprite from an array of equal-length strings; letter = palette color.
export function px(rows, palette, scale = 3) {
  if (!HAS_DOM) return null;
  const w = rows[0].length;
  const h = rows.length;
  const c = document.createElement('canvas');
  c.width = w * scale;
  c.height = h * scale;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const col = palette[rows[y][x]];
      if (col) {
        g.fillStyle = col;
        g.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }
  return c;
}

// Blank low-res canvas for procedural pixel art (trees, houses, rocks...).
// scale up so low-res pixels stay crisp but fill the tile.
export function blank(w, h, scale = 2.5) {
  if (!HAS_DOM) return null;
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const g = c.getContext('2d');
  g.scale(scale, scale);
  return c;
}

// Draw a sprite, optionally flipped horizontally.
export function spr(ctx, img, x, y, flip = false) {
  if (!img || !HAS_DOM) return;
  ctx.save();
  if (flip) {
    ctx.translate(Math.round(x) + img.width, Math.round(y));
    ctx.scale(-1, 1);
  } else {
    ctx.translate(Math.round(x), Math.round(y));
  }
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

// ---- Sheep (12x12, scaled x3 = 36px) --------------------------------
// Two frames: plant and walk. Same silhouette for white and black sheep.
const SHEEP_WOOL = 0;      // white wool
const SHEEP_SHADOW = 1;    // shadowed wool texture

const GRID_IDLE = [
  '....WWWW....',
  '...WWWWWW...',
  '..WWWWWWWW..',
  '.WWWWWWWWWW.',
  '.WWwwwwwwWW.',
  '.WWwFFFFwWW.',
  '.WWwFEDEFwW.',
  '.WWwFMeMFwW.',
  '..WFFFFFFW..',
  '...FFFFFF...',
  '..L....L....',
  '..L....L....',
];

const GRID_WALK = [
  '....WWWW....',
  '...WWWWWW...',
  '..WWWWWWWW..',
  '.WWWWWWWWWW.',
  '.WWwwwwwwWW.',
  '.WWwFFFFwWW.',
  '.WWwFEDEFwW.',
  '.WWwFMeMFwW.',
  '..WFFFFFFW..',
  '...FFFFFF...',
  '....L..L....',
  '....L..L....',
];

const PAL_WHITE = {
  W: '#f8f5ea', w: '#dcd6c4', F: '#a98c6d', E: '#26262e',
  D: '#6b6258', M: '#c9a88e', L: '#cfc8b4',
};

const PAL_BLACK = {
  W: '#2b2b33', w: '#212129', F: '#4a4652', E: '#f2f2f2',
  D: '#8a8a99', M: '#5a5360', L: '#3c3c46',
};

let CACHE = null;
export function sprites() {
  if (CACHE) return CACHE;
  CACHE = {
    sheepWhite: [px(GRID_IDLE, PAL_WHITE, 3), px(GRID_WALK, PAL_WHITE, 3)],
    sheepBlack: [px(GRID_IDLE, PAL_BLACK, 3), px(GRID_WALK, PAL_BLACK, 3)],
  };
  return CACHE;
}

// Which frame + bob offset for a sheep given velocity and time.
export function sheepPose(s, moving, t) {
  const frame = moving ? (Math.floor(t / 160) % 2) : 0;
  const bob = moving ? 0 : Math.round(Math.sin(t / 420) * 1);
  return { img: s[frame], bob };
}

// ---- Memory icons (8x8, scaled x3) ---------------------------------
const ICON_BELL = [
  '..GGG....',
  '.GGGGG...',
  '..GGG....',
  '..GGG....',
  '..G.G....',
  'GGG.GGG..',
  'GGGGGGGG.',
  'GGGGGGGG.',
];
const ICON_TOY = [
  'TTTTTTT..',
  'TtTtTtT..',
  'TTTTTTTT.',
  'TtTtTtT..',
  'TTTTTTTT.',
  'TtTtTtT..',
  'TTTTTTTT.',
  '.........',
];
const ICON_RIBBON = [
  '..RR..RR.',
  '.RRR.RRR.',
  'RRRRRRRR.',
  '.RRRRRR..',
  '..RRRR...',
  '...RR....',
  '...RR....',
  '.........',
];
const ICON_PHOTO = [
  '.WWWWWW..',
  'WbbbbbbW.',
  'WbggbbbW.',
  'WbbbggbW.',
  'WbbbbbbW.',
  'WggbbbbW.',
  '.WWWWWW..',
  '.........',
];
const ICON_FLOWER = [
  '..R..R...',
  '.RRR.RRR.',
  '..RRRR...',
  '...YY....',
  '...YY....',
  '...GG....',
  '...GG....',
  '.........',
];
const PAL_BELL = { G: '#e8b83e', Y: '#f5d76e' };
const PAL_TOY = { T: '#b98a4e', t: '#8f6030' };
const PAL_RIBBON = { R: '#d95b70' };
const PAL_PHOTO = { W: '#efe9d6', b: '#3a4a5a', g: '#7fa66a' };
const PAL_FLOWER = { R: '#e86a92', Y: '#f2c14e', G: '#4e7d36' };

export function memorySprite(item) {
  const s = sprites();
  if (!s.memories) {
    s.memories = {
      bell: px(ICON_BELL, PAL_BELL, 3),
      toy: px(ICON_TOY, PAL_TOY, 3),
      ribbon: px(ICON_RIBBON, PAL_RIBBON, 3),
      photo: px(ICON_PHOTO, PAL_PHOTO, 3),
      flower: px(ICON_FLOWER, PAL_FLOWER, 3),
    };
  }
  return s.memories[item];
}

// ---- Phase 6C: the enlarged Photograph (16x12, x6) -------------------
// Shown during the twin reveal so the player can SEE what the dialogue
// describes: a row of sheep, a cropped dark shape at the frame edge, and a
// small bell, ribbon and flower arranged along the bottom-left edge.
//  W frame · s sky · g grass · S white wool · e eye · k dark wool
//  b bell · r ribbon · f flower
const PHOTO_GRID = [
  'WWWWWWWWWWWWWWWW',
  'WssssssssssssssW',
  'WssssssssssssssW',
  'WsssssssssssskkW',
  'WsSSeSsSSeSsskkW',
  'WsSSSSsSSSSsskkW',
  'WggggggggggggkkW',
  'WggggggggggggkkW',
  'WggggggggggggkkW',
  'WfbggggggggggkkW',
  'WtgrrggggggggkkW',
  'WWWWWWWWWWWWWWWW',
];
const PAL_PHOTO_BIG = {
  W: '#efe9d6', s: '#b8d4e8', g: '#92b26e', S: '#f5f2e6', e: '#7d7160',
  k: '#2b2b33', b: '#e8b83e', r: '#d95b70', f: '#e86a92', t: '#4e7d36',
};

export function photographSprite() {
  const s = sprites();
  if (!s.baaPhoto) s.baaPhoto = px(PHOTO_GRID, PAL_PHOTO_BIG, 6);
  return s.baaPhoto;
}

// ---- Small env pixels (8x8) ----------------------------------------
export function envSprites() {
  const s = sprites();
  if (!s.env) {
    s.env = {
      tuft: px([
        '..G...G.',
        '..G..GG.',
        '..G.GG..',
        '..GG....',
        '........',
        '........',
        '........',
        '........',
      ], { G: '#6aa446' }, 2),
      sign: px([
        '..MMMM..',
        '.MMMMMM.',
        '.MMMMMM.',
        '..WWWW..',
        '.WWWWWW.',
        '..WWWW..',
        '..B.B...',
        '..B.B...',
      ], { M: '#6b5230', W: '#efdfb5', B: '#5d4026' }, 2),
    };
  }
  return s.env;
}

// Procedural pixel helpers used by world.js (trees, houses, rocks).
export function treeSprite(variant) {
  const s = sprites();
  if (!s.trees) s.trees = [];
  if (s.trees[variant]) return s.trees[variant];
  const c = blank(16, 16);
  if (!c) return null;
  const g = c.getContext('2d');
  const greens = [['#2c4f22', '#3f6b2c', '#57a040'], ['#2a5230', '#3c6f3a', '#54a050'], ['#31501e', '#46742c', '#609d3c']][variant];
  const dark = greens[0], mid = greens[1], light = greens[2];
  const trunk = '#5d4026';

  const shape = variant === 1 ? 1.25 : 1;
  const cy = variant === 2 ? 8 : 7;
  // trunk
  g.fillStyle = trunk;
  g.fillRect(6, 11, 2, 5);
  g.fillRect(10, 12, 2, 4);
  // canopy: three stacked pixel circles
  g.fillStyle = dark;
  g.fillRect(3, cy, 10, 6);
  g.fillStyle = mid;
  g.fillRect(4, cy - 1, 8, 6);
  g.fillRect(5, cy + 4, 6, 2);
  g.fillRect(3, cy + 5, 10, 2);
  g.fillStyle = light;
  g.fillRect(5, cy - 2, 6, 4);
  g.fillRect(6, cy - 3, 4, 2);
  // leaf lumps
  g.fillStyle = mid;
  g.fillRect(3, cy - 3, 3, 3);
  g.fillRect(10, cy - 3, 3, 3);
  g.fillRect(4, cy + 6, 2, 2);
  g.fillRect(10, cy + 6, 2, 2);
  g.fillStyle = light;
  g.fillRect(4, cy - 4, 2, 2);
  g.fillRect(10, cy - 4, 2, 2);
  g.fillRect(6, cy + 5, 3, 2);
  // highlight dots
  g.fillStyle = light;
  g.fillRect(7, cy - 1, 1, 1);
  g.fillRect(9, cy + 1, 1, 1);
  g.fillRect(5, cy + 2, 1, 1);
  s.trees[variant] = c;
  return c;
}

export function houseSprite(variant) {
  const s = sprites();
  if (!s.houses) s.houses = [];
  if (s.houses[variant]) return s.houses[variant];
  const c = blank(16, 16);
  if (!c) return null;
  const g = c.getContext('2d');
  const roof = variant === 0 ? ['#b5533c', '#8f3d28'] : ['#8a6a3a', '#6d5130'];
  const wall = variant === 0 ? '#e3d3a8' : '#d5c49a';

  // shadow
  g.fillStyle = 'rgba(30,20,10,0.25)';
  g.fillRect(3, 8, 12, 7);
  // walls
  g.fillStyle = wall;
  g.fillRect(2, 8, 11, 7);
  // roof
  g.fillStyle = roof[0];
  g.fillRect(1, 3, 14, 5);
  g.fillStyle = roof[1];
  g.fillRect(1, 3, 14, 2);
  g.fillRect(5, 2, 6, 6);
  // door
  g.fillStyle = '#6b4528';
  g.fillRect(6, 11, 4, 4);
  g.fillStyle = '#4a2f1a';
  g.fillRect(7, 11, 2, 4);
  // window
  g.fillStyle = '#8fd0e8';
  g.fillRect(3, 9, 3, 3);
  g.fillStyle = '#5a7788';
  g.fillRect(3, 9, 3, 1);
  g.fillRect(4, 9, 1, 3);
  s.houses[variant] = c;
  return c;
}

export function rockSprite(variant) {
  const s = sprites();
  if (!s.rocks) s.rocks = [];
  if (s.rocks[variant]) return s.rocks[variant];
  const c = blank(8, 8);
  if (!c) return null;
  const g = c.getContext('2d');
  g.fillStyle = '#7c7c84';
  g.fillRect(2, 3, 5, 4);
  g.fillRect(1, 4, 7, 3);
  g.fillStyle = '#8f8f97';
  g.fillRect(2, 3, 3, 2);
  g.fillStyle = '#5c5c64';
  g.fillRect(5, 5, 2, 2);
  s.rocks[variant] = c;
  return c;
}