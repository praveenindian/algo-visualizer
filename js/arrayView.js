/* Draws a list of numbers as bars. Each bar is one DOM element that keeps its
 * identity for the whole run, so a swap is two bars sliding past each other
 * instead of two bars changing height. */
(function () {
  const AV = window.AV;
  const MAX = 100;

  AV.ArrayView = class {
    constructor(el) {
      this.el = el;
      el.className = 'canvas';
      el.innerHTML = '<div class="bars"><div class="bar-track"><div class="range-band"></div>' +
        '<div class="target-line" hidden><span></span></div></div><div class="ptr-track"></div></div>';
      this.root = el.firstChild;
      this.track = el.querySelector('.bar-track');
      this.band = el.querySelector('.range-band');
      this.targetLine = el.querySelector('.target-line');
      this.ptrTrack = el.querySelector('.ptr-track');
      this.bars = [];
      this.ptrs = {};
      this.last = null;
      this.ro = new ResizeObserver(() => this.layout());
      this.ro.observe(this.track);
    }

    destroy() { this.ro.disconnect(); this.el.innerHTML = ''; }

    setData(values) {
      this.bars.forEach((b) => b.remove());
      this.bars = values.map((v) => {
        const b = document.createElement('div');
        b.className = 'bar';
        b.style.setProperty('--h', v / MAX);
        b.innerHTML = '<span class="bar-val">' + v + '</span>';
        this.track.appendChild(b);
        return b;
      });
      this.last = null;
      this.layout();
    }

    layout() {
      const n = this.bars.length, W = this.track.clientWidth;
      if (!n || !W) return;
      this.gap = n > 40 ? 2 : n > 24 ? 3 : n > 12 ? 5 : 8;
      this.w = (W - this.gap * (n - 1)) / n;
      for (const b of this.bars) {
        b.style.width = this.w + 'px';
        b.style.setProperty('--r', Math.min(6, this.w / 3) + 'px');
      }
      this.root.classList.toggle('no-labels', this.w < 20);
      if (this.last) this.instant(() => this.render(this.last[0], this.last[1]));
    }

    // Run a render with transitions switched off (used on resize and big jumps).
    instant(fn) {
      this.root.classList.add('no-anim');
      fn();
      void this.root.offsetWidth;
      this.root.classList.remove('no-anim');
    }

    render(step, opts) {
      this.last = [step, opts];
      if (!this.w) return;
      const unit = this.w + this.gap, sorted = new Set(step.sorted), dim = new Set(step.dim);
      const range = step.range;
      step.order.forEach((id, i) => {
        const b = this.bars[id], mark = step.marks[i];
        b.style.transform = 'translateX(' + i * unit + 'px)';
        let cls = 'bar';
        if (dim.has(i)) cls += ' is-dim';
        else if (range && (i < range[0] || i > range[1])) cls += ' is-out';
        if (sorted.has(i)) cls += ' is-sorted';
        if (mark) cls += ' is-' + mark;
        if (b.className !== cls) b.className = cls;
      });

      if (range) {
        this.band.style.transform = 'translateX(' + (range[0] * unit - this.gap / 2) + 'px)';
        this.band.style.width = (range[1] - range[0] + 1) * unit + 'px';
      }
      this.band.style.opacity = range ? 1 : 0;

      const target = opts && opts.target;
      this.targetLine.hidden = target == null;
      if (target != null) {
        this.targetLine.style.setProperty('--t', target / MAX);
        this.targetLine.firstChild.textContent = 'target ' + target;
      }

      // Pointer chips under the bars; chips that share a position stack downward.
      const rows = {};
      for (const name in this.ptrs) this.ptrs[name].hidden = !(name in step.pointers);
      for (const name in step.pointers) {
        const idx = step.pointers[name];
        let p = this.ptrs[name];
        if (!p) {
          p = this.ptrs[name] = document.createElement('div');
          p.className = 'ptr';
          p.innerHTML = '<span></span>';
          p.firstChild.textContent = name;
          this.ptrTrack.appendChild(p);
        }
        const row = rows[idx] || 0;
        rows[idx] = row + 1;
        p.style.transform = 'translate(' + (idx * unit + this.w / 2) + 'px,' + row * 22 + 'px)';
      }
    }
  };
})();
