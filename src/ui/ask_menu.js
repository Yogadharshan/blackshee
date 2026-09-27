// Guided NPC question chooser. Appears after an NPC's opening dialogue and
// stays open for repeated questions until the player leaves. Informational
// only — selecting a question displays an answer and changes no game state.
import { INTENT_LABELS } from '../data/npc_personas.js';

const PANEL = '#1c2027';
const EDGE = '#c9b46a';
const TEXT = '#eae6da';
const DIM = '#9aa0a8';

export function drawAskMenu(ctx, ask, npcName) {
  const top = 452;
  ctx.fillStyle = PANEL;
  ctx.fillRect(20, top, 920, 166);
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = 2;
  ctx.strokeRect(22, top + 2, 916, 162);

  // Speaker plate (same language as the dialogue box).
  ctx.font = 'bold 12px "Courier New", monospace';
  const name = String(npcName || ask.npcName || '').toUpperCase();
  const plateW = 12 + ctx.measureText(name).width + 18;
  ctx.fillStyle = '#2a2e36';
  ctx.fillRect(28, top - 14, plateW, 22);
  ctx.fillStyle = EDGE;
  ctx.fillRect(28, top - 14, plateW, 2);
  ctx.fillStyle = '#f2c14e';
  ctx.fillText(name, 40, top);

  // Prompt.
  ctx.fillStyle = TEXT;
  ctx.font = 'bold 14px "Courier New", monospace';
  ctx.fillText(ask.answer || ask.thinking ? 'What else would you like to ask?' : 'What would you like to ask?', 36, top + 30);

  // Intent list (left column) — only intents this NPC supports.
  ctx.font = '15px "Courier New", monospace';
  ask.intents.forEach((intent, i) => {
    const y = top + 58 + i * 22;
    const sel = i === ask.index;
    if (sel) {
      ctx.fillStyle = 'rgba(201,180,106,0.18)';
      ctx.fillRect(30, y - 15, 448, 20);
    }
    ctx.fillStyle = sel ? '#f2c14e' : DIM;
    ctx.fillText(`${sel ? '>' : ' '} ${i + 1}. ${INTENT_LABELS[intent] || intent}`, 38, y);
  });

  // Answer column (right).
  ctx.fillStyle = 'rgba(201,180,106,0.35)';
  ctx.fillRect(494, top + 20, 2, 112);
  ctx.font = '15px "Courier New", monospace';
  if (ask.thinking) {
    ctx.fillStyle = DIM;
    ctx.fillText('...', 514, top + 60);
  } else if (ask.answer) {
    ctx.fillStyle = TEXT;
    wrap(ask.answer, 46).slice(0, 5).forEach((line, i) => ctx.fillText(line, 514, top + 58 + i * 22));
  } else {
    ctx.fillStyle = DIM;
    ctx.fillText('Choose a question.', 514, top + 60);
  }

  // Footer.
  ctx.fillStyle = DIM;
  ctx.font = '12px "Courier New", monospace';
  ctx.fillText('[↑↓] choose    [1-5] ask    [E] ask    [Esc] leave', 36, top + 158);
}

function wrap(text, width) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > width) {
      lines.push(line.trim());
      line = w;
    } else {
      line += ' ' + w;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}
