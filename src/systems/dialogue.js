export class Dialogue {
  constructor() {
    this.lines = [];
    this.i = 0;
    this.active = false;
    this.onDone = null;
    this._speaker = '';
  }

  start(pairs, onDone) {
    this.lines = pairs;
    this.i = 0;
    this.active = true;
    this._speaker = '';
    this.onDone = onDone || null;
  }

  // The line on screen now. An empty speaker means "keep the last one".
  get current() {
    let [speaker, text] = this.lines[this.i];
    if (speaker) this._speaker = speaker;
    return { speaker: this._speaker, text };
  }

  advance() {
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