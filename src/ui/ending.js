// Ending overlay. R restarts the whole session.
export function drawEnding(ctx, game) {
  ctx.fillStyle = 'rgba(10,12,16,0.93)';
  ctx.fillRect(0, 0, 960, 640);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8e3d5';
  ctx.font = 'bold 34px "Courier New", monospace';
  ctx.fillText('T H E   E N D', 480, 210);

  ctx.fillStyle = '#c9b458';
  ctx.font = '15px "Courier New", monospace';
  ctx.fillText('The seal is broken. The five Memories are home.', 480, 260);
  ctx.fillText('The black sheep was never a mistake.', 480, 290);
  ctx.fillText('Just a different kind of wool, catching a different light.', 480, 320);

  ctx.fillStyle = '#8f97a5';
  ctx.font = '13px "Courier New", monospace';
  ctx.fillText(`Memories collected: ${game.q.memories} / ${game.q.required}`, 480, 380);
  const done = Object.values(game.q.side).filter((s) => s === 'done').length;
  ctx.fillText(`Sidequests finished: ${done} / 3`, 480, 404);
  if (game.q.hiddenFound || game.q.signPokes >= 3) {
    ctx.fillStyle = '#7fa66a';
    ctx.fillText('(you found something off the path. good.)', 480, 434);
  }

  ctx.fillStyle = '#f2e9c9';
  ctx.font = 'bold 16px "Courier New", monospace';
  ctx.fillText('[R] Restart', 480, 500);
  ctx.textAlign = 'left';
}