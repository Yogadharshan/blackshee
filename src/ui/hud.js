import { MAIN } from '../data/quests.js';
import { SIDE } from '../systems/quests.js';

const PANEL = '#22262e';
const PANEL_EDGE = '#c9b46a';
const TEXT = '#e8e3d5';
const DIM = '#9aa0a8';

export function drawHud(ctx, game) {
  const q = game.q;

  // Memory counter chip
  panel(ctx, 10, 10, 168, 34);
  ctx.fillStyle = TEXT;
  ctx.font = 'bold 15px "Courier New", monospace';
  shadowText(ctx, 'MEMORIES', 22, 25, TEXT);
  ctx.fillStyle = q.memories >= q.required ? '#7fa66a' : '#f2c14e';
  ctx.font = 'bold 16px "Courier New", monospace';
  ctx.fillText(`${q.memories}/${q.required}`, 122, 33);

  // Main objective chip
  panel(ctx, 188, 10, 372, 34);
  ctx.fillStyle = '#c9b458';
  ctx.font = 'bold 12px "Courier New", monospace';
  shadowText(ctx, MAIN.title.toUpperCase(), 200, 24, '#c9b458');
  ctx.fillStyle = TEXT;
  ctx.font = '12px "Courier New", monospace';
  ctx.fillText(MAIN.objective, 200, 38);

  // Area name pill
  panel(ctx, 570, 10, 200, 26);
  ctx.fillStyle = '#b8c9a8';
  ctx.font = 'bold 13px "Courier New", monospace';
  shadowText(ctx, game.world.def.name.toUpperCase(), 582, 29, '#b8c9a8');

  // Interact hint
  if (game.near && !game.dialogue.active) {
    panel(ctx, 350, 596, 150, 30);
    ctx.fillStyle = '#f2e9c9';
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillText('[E] Interact', 370, 616);
  }

  // Quest log (Tab)
  if (game.logOpen) drawLog(ctx, game);

  // Controls reminder (first seconds)
  if (game.playTime < 6) {
    panel(ctx, 615, 596, 330, 30);
    ctx.fillStyle = '#cfd6c4';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText('WASD move · E talk · Tab quests', 628, 616);
  }
}

function drawLog(ctx, game) {
  ctx.fillStyle = 'rgba(16,18,22,0.94)';
  ctx.fillStyle = '#1c2027';
  ctx.fillRect(280, 130, 400, 330);
  ctx.strokeStyle = '#c9b46a';
  ctx.lineWidth = 2;
  ctx.strokeRect(282, 132, 396, 326);
  // corner studs
  ctx.fillStyle = '#c9b46a';
  ctx.fillRect(280, 130, 6, 6);
  ctx.fillRect(674, 130, 6, 6);
  ctx.fillRect(280, 454, 6, 6);
  ctx.fillRect(674, 454, 6, 6);

  ctx.fillStyle = '#f2e9c9';
  ctx.font = 'bold 16px "Courier New", monospace';
  shadowText(ctx, 'QUEST LOG', 300, 162, '#f2e9c9');

  ctx.font = '12px "Courier New", monospace';
  ctx.fillStyle = '#c9b458';
  ctx.fillText(`${MAIN.title}  [${game.q.memories}/${MAIN.required}]`, 300, 192);
  ctx.fillStyle = '#9aa0a8';
  ctx.fillText(MAIN.objective, 300, 212);

  let y = 248;
  for (const s of Object.values(SIDE)) {
    const st = game.q.side[s.id] || 'idle';
    const col = st === 'done' ? '#7fa66a' : st === 'active' ? '#d9c07a' : '#6e7480';
    ctx.fillStyle = col;
    ctx.fillText(`${s.title} — ${STATUS[st]}`, 300, y);
    y += 26;
  }
  ctx.fillStyle = '#9aa0a8';
  ctx.fillText('[Tab] close', 640, 450);
}

const STATUS = { idle: 'Available', active: 'In progress', done: 'Done' };

// slim pixel frame: fill + 2px edge + corner dots
function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PANEL;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PANEL_EDGE;
  ctx.fillRect(x, y, w, 2);
  ctx.fillRect(x, y + h - 2, w, 2);
  ctx.fillRect(x, y, 2, h);
  ctx.fillRect(x + w - 2, y, 2, h);
  ctx.fillStyle = 'rgba(201,180,106,0.35)';
  ctx.fillRect(x + 3, y + 3, 3, 3);
}

function shadowText(ctx, text, x, y, color) {
  ctx.fillStyle = '#10141a';
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}