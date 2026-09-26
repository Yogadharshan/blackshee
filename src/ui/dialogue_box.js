// Bottom dialogue panel: speaker plate + wrapped text, pixel frame.
export function drawDialogueBox(ctx, dialogue) {
  const cur = dialogue.current;
  const text = cur.text || '';
  const top = 470;
  ctx.fillStyle = '#1c2027';
  ctx.fillRect(20, top, 920, 150);
  ctx.strokeStyle = '#c9b46a';
  ctx.lineWidth = 2;
  ctx.strokeRect(22, top + 2, 916, 146);

  if (cur.speaker) {
    // speaker plate
    ctx.fillStyle = '#2a2e36';
    ctx.fillRect(28, top - 14, 12 + ctx.measureText(cur.speaker.toUpperCase()).width + 18, 22);
    ctx.fillStyle = '#c9b46a';
    ctx.fillRect(28, top - 14, 12 + ctx.measureText(cur.speaker.toUpperCase()).width + 18, 2);
    ctx.fillStyle = '#f2c14e';
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.fillText(cur.speaker.toUpperCase(), 40, top - 0);
  }

  ctx.fillStyle = '#eae6da';
  ctx.font = '16px "Courier New", monospace';
  const wrapped = wrap(text, 54);
  wrapped.forEach((line, i) => ctx.fillText(line, 36, top + 40 + i * 22));

  // advance arrow (blinks)
  if (Math.floor(performance.now() / 420) % 2 === 0) {
    ctx.fillStyle = '#f2e9c9';
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillText('▼ [E]', 858, top + 140);
  }
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