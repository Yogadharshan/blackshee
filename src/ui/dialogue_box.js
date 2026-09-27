// Bottom dialogue panel: speaker plate + wrapped text, pixel frame.
// When `staged` (Phase 6C), THE FORGOTTEN BAA's own lines render as held
// recognition beats: centered, larger and brighter than ordinary NPC dialogue.
export function drawDialogueBox(ctx, dialogue, staged = false) {
  const cur = dialogue.current;
  const text = cur.text || '';
  const voice = staged && cur.speaker === 'THE FORGOTTEN BAA';
  const top = 470;
  ctx.fillStyle = '#1c2027';
  ctx.fillRect(20, top, 920, 150);
  ctx.strokeStyle = voice ? '#e0c56a' : '#c9b46a';
  ctx.lineWidth = 2;
  ctx.strokeRect(22, top + 2, 916, 146);

  if (cur.speaker) {
    // speaker plate
    ctx.fillStyle = '#2a2e36';
    const w = 12 + ctx.measureText(cur.speaker.toUpperCase()).width + 18;
    ctx.fillRect(28, top - 14, w, 22);
    ctx.fillStyle = voice ? '#e0c56a' : '#c9b46a';
    ctx.fillRect(28, top - 14, w, 2);
    ctx.fillStyle = '#f2c14e';
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.fillText(cur.speaker.toUpperCase(), 40, top - 0);
  }

  if (voice) {
    const savedAlign = ctx.textAlign;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f6ecd2';
    ctx.font = 'bold 20px "Courier New", monospace';
    const held = wrap(text, 44).slice(0, 3);
    held.forEach((line, i) => ctx.fillText(line, 480, top + 52 + i * 28));
    ctx.textAlign = savedAlign;
  } else {
    ctx.fillStyle = '#eae6da';
    ctx.font = '16px "Courier New", monospace';
    wrap(text, 54).forEach((line, i) => ctx.fillText(line, 36, top + 40 + i * 22));
  }

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

// Phase 6 choice prompt: the same panel language as the dialogue box, with the
// two authored replies listed and one highlighted. Presentation only.
export function drawChoiceBox(ctx, choice) {
  const top = 430;
  ctx.fillStyle = '#1c2027';
  ctx.fillRect(20, top, 920, 190);
  ctx.strokeStyle = '#c9b46a';
  ctx.lineWidth = 2;
  ctx.strokeRect(22, top + 2, 916, 186);

  ctx.fillStyle = '#eae6da';
  ctx.font = '16px "Courier New", monospace';
  wrap(choice.prompt || '', 60).slice(0, 3).forEach((line, i) => ctx.fillText(line, 36, top + 36 + i * 22));

  choice.options.forEach((opt, i) => {
    const y = top + 120 + i * 30;
    const sel = i === choice.index;
    if (sel) {
      ctx.fillStyle = 'rgba(201,180,106,0.18)';
      ctx.fillRect(30, y - 20, 880, 26);
    }
    ctx.fillStyle = sel ? '#f2c14e' : '#9aa0a8';
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillText(`${sel ? '>' : ' '} ${i + 1}. ${opt.label}`, 40, y);
  });

  ctx.fillStyle = '#9aa0a8';
  ctx.font = '12px "Courier New", monospace';
  ctx.fillText('[↑↓] choose    [1-2] select    [E] confirm', 36, top + 180);
}