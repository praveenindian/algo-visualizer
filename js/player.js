/* Moves through a recorded list of steps: play, pause, step and seek. */
(function () {
  const AV = window.AV;

  AV.Player = class {
    constructor(onFrame, onState) {
      this.onFrame = onFrame;
      this.onState = onState;
      this.steps = [];
      this.i = 0;
      this.playing = false;
      this.delay = 160;   // ms between steps
      this.stride = 1;    // steps advanced per tick
    }

    get last() { return this.steps.length - 1; }
    get atEnd() { return this.steps.length > 1 && this.i === this.last; }

    load(steps, atEnd) {
      this.pause();
      this.steps = steps;
      this.i = atEnd ? steps.length - 1 : 0;
      this.emit(true);
    }

    emit(jump) { this.onFrame(this.steps[this.i], this.i, this.steps.length, jump); }

    seek(i, jump) {
      i = Math.max(0, Math.min(this.last, i));
      if (i === this.i) return;
      this.i = i;
      this.emit(jump);
    }

    step(d) { this.pause(); this.seek(this.i + d); }

    play() {
      if (this.steps.length < 2) return;
      if (this.i >= this.last) { this.i = 0; this.emit(true); }
      this.playing = true;
      this.onState(true);
      this.tick();
    }

    tick() {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        if (!this.playing) return;
        this.seek(this.i + this.stride);
        if (this.i >= this.last) this.pause(); else this.tick();
      }, this.delay);
    }

    pause() {
      clearTimeout(this.timer);
      if (this.playing) { this.playing = false; this.onState(false); }
    }

    toggle() { this.playing ? this.pause() : this.play(); }
  };
})();
