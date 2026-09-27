// NPC dialogue service: produces NPC *wording* only.
//
// ── FROZEN ───────────────────────────────────────────────────────────────────
// This optional AI layer is complete and frozen (2026-09-27). It is not
// required for play and is fully fallback-governed. Do not extend it: add no
// providers, no NPCs, no free chat. Known limitation — the Hugging Face weight
// CDN (us.aws.cdn.hf.co) is unreachable on some networks, so the local model
// stays failed and scripted answers govern. See docs/ai npc build.md.
// ─────────────────────────────────────────────────────────────────────────────
//
// Boundary rule: this layer NEVER mutates game state. Quest progression,
// item/Memory changes and all flags stay in talkFor()/rewardFor() (see
// systems/quests.js). The service is handed a constrained context (see
// npc_context.js) and returns a short line of text.
//
// Providers:
//   LocalSLMProvider        — optional browser-local model (see npc_slm.js)
//   ScriptedDialogueProvider — complete fallback, always available
//
// Provider selection happens once, during initialize(): the local SLM is
// attempted a single time and permanently falls back to scripted if it cannot
// load. Generation never retries the model, never blocks the game, and never
// changes game state.
//
// A provider implements:
//   initialize(): Promise<void>
//   isAvailable(): boolean
//   generate(context): Promise<string|null>
//
// No provider may import Transformers.js at module load; only npc_slm.js may,
// and only via a guarded dynamic import.

import { selectAnswer } from '../data/npc_answers.js';
import { LocalSLMProvider, detectWebGPU } from './npc_slm.js';

// Lore-safe fallback used whenever a provider cannot produce a line. Players
// never see a raw error; an NPC just sounds a little lost.
export const FALLBACK_LINE = 'Hmm... my thoughts are a little tangled today.';

// NPCs allowed to use the local SLM. Phase 3 is the Elder vertical slice only.
export const LOCAL_SLM_NPCS = Object.freeze(['elder']);

// Default provider: deterministic, synchronous under the hood, always ready.
export class ScriptedDialogueProvider {
  constructor() {
    this.name = 'scripted';
    this.status = 'ready';
    this.ready = false;
  }

  // Resolves immediately.
  async initialize() {
    this.ready = true;
  }

  // Always available; the game can always talk.
  isAvailable() {
    return true;
  }

  // Wording only. Prefers a caller-supplied line, then stage-gated content.
  // The stage comes from the constrained context, never recomputed here.
  async generate(context) {
    if (context && typeof context.scriptedAnswer === 'string' && context.scriptedAnswer) {
      return context.scriptedAnswer;
    }
    const npcId = context && context.npc && context.npc.id;
    const intent = context && context.intent;
    const stage = (context && typeof context.baaStage === 'number') ? context.baaStage : 0;
    return selectAnswer(npcId, intent, stage) || FALLBACK_LINE;
  }
}

// Owns provider selection and the single fallback path.
export class NPCDialogueService {
  constructor({ localFactory, eligible } = {}) {
    // The fallback exists from construction so an uninitialized service is safe.
    this.fallback = new ScriptedDialogueProvider();
    this.provider = this.fallback;       // active primary provider
    this.local = null;                   // the LocalSLMProvider instance, if any
    this.status = 'unavailable';         // unavailable | loading | ready | failed
    this.lastError = null;
    this._eligible = new Set(eligible || LOCAL_SLM_NPCS);
    this._localFactory = localFactory || (() => new LocalSLMProvider());
    this._localPromise = null;
    this._disabled = false;
  }

  // Selects a provider once. Never blocks: the local attempt runs in the
  // background while the game keeps playing on the scripted provider.
  async initialize() {
    await this.fallback.initialize();
    this.provider = this.fallback;
    if (!this._disabled) {
      this.status = 'loading';
      this._localPromise = this._attemptLocal();
    }
    return this;
  }

  // Permanently disable the local path (used by tests / ?noai=1).
  disableLocal() {
    this._disabled = true;
    this.provider = this.fallback;
    this.status = 'unavailable';
  }

  // Resolves when the one-shot local attempt settles. Never rejects.
  ready() {
    return this._localPromise || Promise.resolve();
  }

  async _attemptLocal() {
    let provider;
    try {
      provider = this._localFactory();
    } catch (e) {
      this.lastError = String((e && e.message) || e);
      this.provider = this.fallback;
      this.status = 'failed';
      return;
    }
    // Expose immediately so live load progress is visible while it downloads.
    this.local = provider;
    this.status = 'loading';
    try {
      await provider.initialize();
    } catch (e) {
      this.lastError = String((e && e.message) || e);
    }
    if (provider.isAvailable()) {
      this.provider = provider;
      this.status = 'ready';
    } else {
      this.provider = this.fallback;
      this.status = provider.status === 'failed' ? 'failed' : 'unavailable';
      if (provider.error) this.lastError = provider.error;
    }
  }

  get providerName() {
    return this.provider ? this.provider.name : 'none';
  }

  // The service can always answer: the scripted fallback is always available.
  isAvailable() {
    return !!(this.provider && this.provider.isAvailable()) ||
      !!(this.fallback && this.fallback.isAvailable());
  }

  // Only the vertical-slice NPCs may use the local provider.
  isEligible(context) {
    return !!(context && context.npc && this._eligible.has(context.npc.id));
  }

  // Clean async surface. Always resolves to a short string and never throws.
  // Uses the local provider only when it is ready AND the NPC is eligible;
  // otherwise (or on any failure) the scripted provider answers.
  async generate(context) {
    if (this.status === 'ready' && this.isEligible(context)) {
      try {
        const text = await this.provider.generate(context);
        if (typeof text === 'string' && text) return text;
      } catch (e) {
        this.lastError = String((e && e.message) || e);
      }
    }
    try {
      return await this.fallback.generate(context);
    } catch {
      return FALLBACK_LINE;
    }
  }

  // Debug/test hook. Plain data only; no functions, no game state.
  debug() {
    const local = this.local;
    return {
      status: this.status,
      selected: this.providerName,
      eligible: [...this._eligible],
      webgpu: detectWebGPU(),
      importOk: local ? local.importOk : false,
      modelReady: !!(local && local.isAvailable()),
      progress: local ? local.progress : 0,
      progressLabel: local ? (local.progressLabel || '') : '',
      inferences: local ? local.inferences : 0,
      timings: local ? { ...local.timings } : null,
      lastError: this.lastError || (local && local.error) || null,
      disabled: this._disabled,
    };
  }
}

export function createNPCDialogueService(options) {
  return new NPCDialogueService(options);
}

// Shared instance used by the game bootstrap.
export const npcDialogue = new NPCDialogueService();
