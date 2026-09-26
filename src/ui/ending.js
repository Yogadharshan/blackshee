// Ending overlay, pixel-styled. R restarts the whole session.
export function drawEnding(ctx, game) {
  ctx.fillStyle = 'rgba(10,12,16,0.93)';
  ctx.fillRect(0, 0, 960, 640);

  // pixel frame
  ctx.strokeStyle = '#c9b46a';
  ctx.lineWidth = 2;
  ctx.strokeRect(150, 90, 660, 460);
  ctx.fillStyle = '#c9b46a';
  ctx.fillRect(150, 90, 8, 8);
  ctx.fillRect(802, 90, 8, 8);
  ctx.fillRect(150, 542, 8, 8);
  ctx.fillRect(802, 542, 8, 8);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2e9c9';
  ctx.font = 'bold 34px "Courier New", monospace';
  ctx.fillText('T H E   E N D', 481, 212);
  ctx.fillStyle = '#000';
  ctx.fillText('T H E   E N D', 482, 213);

  ctx.fillStyle = '#c9b458';
  ctx.font = '15px "Courier New", monospace';
  ctx.fillText('The seal is broken. The five Memories are home.', 480, 262);
  ctx.fillText('The black sheep was never a mistake.', 480, 292);
  ctx.fillText('Just a different kind of wool, catching a different light.', 480, 322);

  ctx.fillStyle = '#9aa0a8';
  ctx.font = '13px "Courier New", monospace';
  ctx.fillText(`Memories collected: ${game.q.memories} / ${game.q.required}`, 480, 382);
  const done = Object.values(game.q.side).filter((s) => s === 'done').length;
  ctx.fillText(`Sidequests finished: ${done} / 3`, 480, 406);
  if (game.q.hiddenFound || game.q.signPokes >= 3) {
    ctx.fillStyle = '#7fa66a';
    ctx.fillText('(you found something off the path. good.)', 480, 436);
  }

  ctx.fillStyle = '#f2e9c9';
  ctx.font = 'bold 16px "Courier New", monospace';
  ctx.fillText('[R] Restart', 480, 500);
  ctx.textAlign = 'left';
}