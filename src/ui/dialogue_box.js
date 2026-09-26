// Bottom dialogue panel: speaker name + wrapped text.
export function drawDialogueBox(ctx, dialogue) {
  const cur = dialogue.current;
  const text = cur.text || '';
  const top = 470;
  ctx.fillStyle = 'rgba(22,24,30,0.95)';
  ctx.fillRect(20, top, 920, 150);
  ctx.strokeStyle = '#d9c07a';
  ctx.lineWidth = 3;
  ctx.strokeRect(22, top + 2, 916, 146);

  if (cur.speaker) {
    ctx.fillStyle = '#c9b458';
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillText(cur.speaker.toUpperCase(), 36, top + 28);
    ctx.fillStyle = 'rgba(217,192,122,0.4)';
    ctx.fillRect(36, top + 36, 120, 2);
  }

  ctx.fillStyle = '#eae6da';
  ctx.font = '16px "Courier New", monospace';
  const wrapped = wrap(text, 54);
  wrapped.forEach((line, i) => ctx.fillText(line, 36, top + 62 + i * 22));

  // advance arrow
  ctx.fillStyle = '#f2e9c9';
  ctx.font = 'bold 14px "Courier New", monospace';
  ctx.fillText('▼ [E]', 860, top + 140);
}

function wrap(text, width) {
  const words = text.split(' ');
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