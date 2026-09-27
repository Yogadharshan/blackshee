export class Dialogue {
  constructor() {
    this.lines = [];
    this.i = 0;
    this.active = false;
    this.onDone = null;
    this._speaker = '';
    // Phase 6: an optional two-reply choice. When set, the dialogue is active but
    // frozen on `choice.prompt` + options until the player picks. Picking runs
    // choice.onPick(optionId), which does the state write + consequence dialogue.
    this.choice = null;
  }

  start(pairs, onDone) {
    this.lines = pairs;
    this.i = 0;
    this.active = true;
    this._speaker = '';
    this.choice = null;
    this.onDone = onDone || null;
  }

  // Present a short authored prompt with two replies. The world stays frozen
  // (active) until picked. No branching tree: one pick, one consequence.
  startChoice(prompt, options, onPick) {
    this.lines = [];
    this.i = 0;
    this.active = true;
    this._speaker = '';
    this.choice = { prompt, options, index: 0, onPick: onPick || null };
  }

  get choosing() {
    return !!this.choice;
  }

  moveChoice(delta) {
    if (!this.choice) return;
    const n = this.choice.options.length;
    this.choice.index = (this.choice.index + delta + n) % n;
  }

  pickChoice(index) {
    if (!this.choice) return;
    const n = this.choice.options.length;
    this.choice.index = Math.max(0, Math.min(n - 1, index));
    this.advance();
  }

  // The line on screen now. An empty speaker means "keep the last one".
  get current() {
    if (this.choice) return { speaker: '', text: this.choice.prompt };
    let [speaker, text] = this.lines[this.i];
    if (speaker) this._speaker = speaker;
    return { speaker: this._speaker, text };
  }

  advance() {
    if (this.choice) {
      const opt = this.choice.options[this.choice.index];
      const cb = this.choice.onPick;
      this.choice = null;
      if (cb) cb(opt.id);
      return this.active;
    }
    this.i++;
    if (this.i >= this.lines.length) {
      this.active = false;
      const cb = this.onDone;
      this.onDone = null;
      if (cb) cb();
      return false;
    }
    return true;
  }
}