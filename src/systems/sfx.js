// Tiny WebAudio synth blips — no audio files, no dependencies.
// Created lazily on the first user gesture (browsers block audio before that).
let ctx = null;

export function ensureAudio() {
  if (!ctx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    } catch (e) { ctx = null; }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

function blip(freq, dur, type = 'square', vol = 0.04, when = 0) {
  if (!ctx) return;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    const t = ctx.currentTime + when;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch (e) { /* audio must never break the game */ }
}

export const sfx = {
  step: () => blip(320, 0.03, 'square', 0.012),
  advance: () => blip(440, 0.05, 'triangle', 0.04),
  pickup: () => { blip(660, 0.09); blip(880, 0.12, 'square', 0.05, 0.06); },
  open: () => {
    blip(523, 0.12, 'triangle', 0.05);
    blip(659, 0.12, 'triangle', 0.05, 0.1);
    blip(784, 0.22, 'triangle', 0.05, 0.2);
  },
  done: () => { blip(392, 0.15, 'triangle', 0.05); blip(523, 0.3, 'triangle', 0.05, 0.12); },
};