// Optional browser-local SLM provider for NPC dialogue.
//
// This is the ONLY file allowed to reference Transformers.js, and it does so
// via a *guarded dynamic import* — never a static/top-level import, so the game
// boots fine with no network and no WebGPU. Everything here fails closed: on
// any problem the provider reports unavailable and the game uses the scripted
// provider instead. Nothing in this file touches game state; it returns a
// string (or null).
//
// Assumptions / limits:
// - One model, one config. No model-selection infrastructure.
// - Inference timeout is conservative (see INFER_TIMEOUT_MS). The underlying
//   pipeline call cannot be truly cancelled, so a timed-out call is abandoned
//   and that conversation falls back to scripted wording.
// - Weights are fetched from the HF/CDN and cached by the browser; nothing is
//   vendored into the repo.

import { INTENT_LABELS } from '../data/npc_personas.js';

const TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3';
const MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct';
const MAX_NEW_TOKENS = 100;
export const INFER_TIMEOUT_MS = 8000;
export const MAX_REPLY_CHARS = 360;
// Time to fetch the Transformers.js module itself.
export const IMPORT_TIMEOUT_MS = 20000;
// If no download progress arrives for this long, treat the load as stalled
// (e.g. a privacy blocker hanging the weight CDN) and fall back to scripted.
export const LOAD_STALL_MS = 20000;

const now = () => (globalThis.performance ? performance.now() : Date.now());

// --- download progress (pure + testable) ------------------------------------
// Aggregates Transformers.js per-file progress into one moving ratio so the
// status indicator actually updates instead of sitting at 0%.
export function createProgress() {
  return { files: new Map(), phase: 'starting', file: null, loadedBytes: 0, totalBytes: 0, ratio: 0, updatedAt: now() };
}

export function applyProgress(pr, p) {
  if (!pr || !p) return pr;
  pr.updatedAt = now();
  if (p.status) pr.phase = p.status;
  if (p.file || p.name) pr.file = p.file || p.name;
  if (p.file) {
    const cur = pr.files.get(p.file) || { loaded: 0, total: 0 };
    if (typeof p.loaded === 'number') cur.loaded = p.loaded;
    if (typeof p.total === 'number' && p.total > 0) cur.total = p.total;
    pr.files.set(p.file, cur);
  }
  let loaded = 0;
  let total = 0;
  for (const f of pr.files.values()) { loaded += f.loaded; total += f.total; }
  pr.loadedBytes = loaded;
  pr.totalBytes = total;
  if (total > 0) pr.ratio = Math.min(1, loaded / total);
  else if (typeof p.progress === 'number') pr.ratio = Math.min(1, p.progress / 100);
  return pr;
}

const mb = (n) => (n / 1048576).toFixed(1);
export function formatProgress(pr) {
  if (!pr) return '';
  const file = pr.file ? String(pr.file).split('/').pop() : '';
  const bytes = pr.totalBytes > 0 ? `${mb(pr.loadedBytes)}/${mb(pr.totalBytes)} MB` : '';
  return [file, bytes].filter(Boolean).join(' · ');
}

// Never show 100% while still loading: small config files completing shouldn't
// look like the (large) weights finished.
export function displayProgress(ratio) {
  return Math.min(0.99, Math.max(0, ratio || 0));
}

// Optional overrides for restricted networks / self-hosting. Defaults to the
// official HF host and remote loading. Both are read from the page URL, e.g.
//   ?hfhost=https://my-mirror   (point at a reachable model host)
//   ?localmodel=1               (load from /models/<MODEL_ID>/ served same-origin)
export function pickModelHost(search, globalHost) {
  try {
    if (search) {
      const q = new URLSearchParams(search).get('hfhost');
      if (q) return q.replace(/\/+$/, '');
    }
  } catch { /* ignore */ }
  return globalHost ? String(globalHost).replace(/\/+$/, '') : null;
}

export function pickLocalModel(search, globalFlag) {
  try {
    if (search) {
      const q = new URLSearchParams(search).get('localmodel');
      if (q === '1' || q === 'true') return true;
    }
  } catch { /* ignore */ }
  return !!globalFlag;
}

export const LOCAL_MODEL_PATH = '/models/';

// Sync presence check (cheap). The real gate is hasWebGPU(), which also asks
// for an adapter and is awaited during initialize().
export function detectWebGPU() {
  try {
    return typeof navigator !== 'undefined' && !!navigator.gpu;
  } catch {
    return false;
  }
}

// True only if WebGPU exists AND an adapter can actually be acquired.
export async function hasWebGPU() {
  try {
    if (!detectWebGPU()) return false;
    if (typeof navigator.gpu.requestAdapter !== 'function') return false;
    const adapter = await navigator.gpu.requestAdapter();
    return !!adapter;
  } catch {
    return false;
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('inference-timeout')), ms);
    promise.then(
      (v) => { clearTimeout(id); resolve(v); },
      (e) => { clearTimeout(id); reject(e); },
    );
  });
}

// Turn the constrained context (npc_context.js) into a compact chat prompt.
// Uses only curated fields — no game objects, no raw state, no stage numbers.
export function buildMessages(context) {
  const facts = (context.knownFacts || [])
    .map((f) => `- ${f.text}`)
    .join('\n') || '- (nothing specific comes to mind)';
  const intent = INTENT_LABELS[context.intent] || context.intent || 'a general question';
  const system = [
    `You are ${context.npc.name} in BLACKSHEE, a small retro sheep adventure game.`,
    'Speak as a character in that game, in one or two short sentences of dialogue.',
    '',
    `PERSONALITY: ${context.personality}`,
    `LOCATION: ${context.location}`,
    `MOOD: ${context.emotionalState}`,
    'KNOWN FACTS:',
    facts,
    '',
    'RULES:',
    '- Answer only using the known facts.',
    '- If you do not know something, say you do not remember.',
    '- Never invent people, places, quests, items, or game rules.',
    '- Never mention being a model, an AI, or a language model.',
    '- Stay in character. Keep it short.',
  ].join('\n');
  const user = `The player asks: ${intent}` +
    (context.playerLine ? ` (they said: "${context.playerLine}")` : '');
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

// Extract the assistant text from the various shapes Transformers.js may return.
export function extractText(out) {
  const first = Array.isArray(out) ? out[0] : out;
  if (!first) return null;
  const g = first.generated_text;
  if (typeof g === 'string') return g;
  if (Array.isArray(g)) {
    const last = [...g].reverse().find((m) => m && m.role === 'assistant' && typeof m.content === 'string');
    if (last) return last.content;
    const tail = g[g.length - 1];
    if (tail && typeof tail.content === 'string') return tail.content;
  }
  return null;
}

// Small, strict output sanitizer. Returns a short string or null (=> scripted).
export function sanitizeReply(raw) {
  if (typeof raw !== 'string') return null;
  let t = raw.replace(/\s+/g, ' ').trim();
  // Strip a leading role/prompt echo.
  t = t.replace(/^(assistant|system|user|npc|elder sheep)\s*:\s*/i, '');
  // Strip surrounding quotes.
  t = t.replace(/^["'“”‘’]+/, '').replace(/["'“”‘’]+$/, '').trim();
  // Reject prompt-section leakage or assistant-speak.
  if (/^(known facts|rules|personality|location|mood|player asks)/i.test(t)) return null;
  if (/\b(as an ai|an ai language model|language model|i am unable to|i cannot (help|assist)|i'm sorry, but)\b/i.test(t)) return null;
  // Clamp to at most three sentences.
  const sentences = t.match(/[^.!?]+[.!?]*/g) || [];
  if (sentences.length > 3) t = sentences.slice(0, 3).join('').trim();
  // Clamp length without cutting mid-word.
  if (t.length > MAX_REPLY_CHARS) t = t.slice(0, MAX_REPLY_CHARS).replace(/\s+\S*$/, '').trim();
  if (t.replace(/[^a-zA-Z0-9]/g, '').length < 2) return null; // obviously malformed
  return t;
}

export class LocalSLMProvider {
  constructor() {
    this.name = 'local-slm';
    this.status = 'unavailable';   // unavailable | loading | ready | failed
    this.pipeline = null;
    this.importOk = false;
    this.error = null;
    this.progress = 0;             // ratio 0..1 during loading
    this.progressLabel = '';       // e.g. "model_q4.onnx · 12.3/340.5 MB"
    this._prog = createProgress();
    this.inferences = 0;
    this.timings = { initMs: null, firstInferenceMs: null, lastInferenceMs: null };
  }

  isAvailable() {
    return this.status === 'ready' && !!this.pipeline;
  }

  async initialize() {
    if (!detectWebGPU()) { this.status = 'unavailable'; return; }
    this.status = 'loading';
    this._prog = createProgress();
    this.progress = 0;
    this.progressLabel = '';
    const t0 = now();
    try {
      const tf = await withTimeout(import(/* @vite-ignore */ TRANSFORMERS_CDN), IMPORT_TIMEOUT_MS);
      this.importOk = true;
      if (tf.env) {
        const search = (typeof location !== 'undefined' && location.search) || '';
        const host = pickModelHost(search, globalThis.__hfHost);
        if (host) tf.env.remoteHost = host;
        if (pickLocalModel(search, globalThis.__localModel)) {
          tf.env.allowRemoteModels = false;
          tf.env.localModelPath = LOCAL_MODEL_PATH;
        }
      }
      this.pipeline = await this._loadPipeline(tf);
      this.status = 'ready';
      this.timings.initMs = Math.round(now() - t0);
    } catch (e) {
      this.error = String((e && e.message) || e);
      this.status = 'failed';
      this.pipeline = null;
    }
  }

  // Load the model while feeding progress out and failing fast if the download
  // stalls (no progress events for LOAD_STALL_MS), so the UI never spins forever.
  async _loadPipeline(tf) {
    let last = now();
    const load = tf.pipeline('text-generation', MODEL_ID, {
      dtype: 'q4',
      device: 'webgpu',
      progress_callback: (p) => {
        last = now();
        applyProgress(this._prog, p);
        this.progress = displayProgress(this._prog.ratio);
        this.progressLabel = formatProgress(this._prog);
      },
    });
    let timer;
    const stall = new Promise((_, reject) => {
      timer = setInterval(() => {
        if (now() - last > LOAD_STALL_MS) {
          clearInterval(timer);
          reject(new Error('load-stalled (no progress from weight CDN)'));
        }
      }, 1000);
    });
    try {
      return await Promise.race([load, stall]);
    } finally {
      clearInterval(timer);
    }
  }

  // Returns a short validated string, or null so the caller falls back.
  async generate(context) {
    if (!this.isAvailable()) return null;
    const t0 = now();
    try {
      const messages = buildMessages(context);
      const out = await withTimeout(
        this.pipeline(messages, { max_new_tokens: MAX_NEW_TOKENS, do_sample: false }),
        INFER_TIMEOUT_MS,
      );
      const text = sanitizeReply(extractText(out));
      if (!text) return null;
      const dt = Math.round(now() - t0);
      if (this.timings.firstInferenceMs == null) this.timings.firstInferenceMs = dt;
      this.timings.lastInferenceMs = dt;
      this.inferences++;
      return text;
    } catch (e) {
      // Inference failures are per-conversation; the game falls back to scripted.
      this.error = String((e && e.message) || e);
      return null;
    }
  }
}
