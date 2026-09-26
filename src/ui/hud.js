import { MAIN } from '../data/quests.js';
import { SIDE } from '../systems/quests.js';

const STATUS = {
  idle: 'Available',
  active: 'In progress',
  done: 'Done',
};

export function drawHud(ctx, game) {
  const q = game.q;

  // Top bar chips
  ctx.fillStyle = 'rgba(20,22,26,0.72)';
  ctx.fillRect(10, 10, 210, 34);
  ctx.fillStyle = '#e8e3d5';
  ctx.font = 'bold 15px "Courier New", monospace';
  ctx.fillText(`MEMORIES  ${q.memories} / ${q.required}`, 22, 33);

  ctx.fillStyle = 'rgba(20,22,26,0.72)';
  ctx.fillRect(240, 10, 320, 34);
  ctx.fillStyle = '#c9b458';
  ctx.font = '12px "Courier New", monospace';
  ctx.fillText(MAIN.title.toUpperCase(), 252, 26);
  ctx.fillStyle = '#e8e3d5';
  ctx.fillText(MAIN.objective, 252, 40);

  // Area name
  ctx.fillStyle = 'rgba(20,22,26,0.72)';
  ctx.fillRect(600, 10, 160, 26);
  ctx.fillStyle = '#b8c9a8';
  ctx.font = 'bold 13px "Courier New", monospace';
  ctx.fillText(game.world.def.name, 612, 29);

  // Interact hint
  if (game.near && !game.dialogue.active) {
    ctx.fillStyle = 'rgba(20,22,26,0.78)';
    ctx.fillRect(360, 596, 240, 30);
    ctx.fillStyle = '#f2e9c9';
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillText('[E] Interact', 380, 616);
  }

  // Quest log (Tab)
  if (game.logOpen) drawLog(ctx, game);

  // Controls reminder (first seconds)
  if (game.playTime < 6) {
    ctx.fillStyle = 'rgba(20,22,26,0.7)';
    ctx.fillRect(615, 596, 330, 30);
    ctx.fillStyle = '#cfd6c4';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText('WASD move · E talk · Tab quests', 628, 616);
  }
}

function drawLog(ctx, game) {
  ctx.fillStyle = 'rgba(16,18,22,0.92)';
  ctx.fillRect(280, 130, 400, 330);
  ctx.strokeStyle = '#8a8f7a';
  ctx.strokeRect(280.5, 130.5, 399, 329);
  ctx.fillStyle = '#f2e9c9';
  ctx.font = 'bold 16px "Courier New", monospace';
  ctx.fillText('QUEST LOG', 300, 162);

  ctx.font = '12px "Courier New", monospace';
  ctx.fillStyle = '#c9b458';
  ctx.fillText(`${MAIN.title}  [${game.q.memories}/${MAIN.required}]`, 300, 192);
  ctx.fillStyle = '#8f97a5';
  ctx.fillText(MAIN.objective, 300, 212);

  let y = 248;
  for (const s of Object.values(SIDE)) {
    const st = game.q.side[s.id] || 'idle';
    ctx.fillStyle = st === 'done' ? '#7fa66a' : st === 'active' ? '#d9c07a' : '#6e7480';
    ctx.fillText(`${s.title} — ${STATUS[st]}`, 300, y);
    y += 26;
  }
  ctx.fillStyle = '#8f97a5';
  ctx.fillText('[Tab] close', 640, 450);
}