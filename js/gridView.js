/* The pathfinding grid: draws cells, lets you paint walls and weights and drag
 * the start and target, and replays the steps of a search. */
(function () {
  const AV = window.AV;
  const GAP = 2;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const odd = (v, size) => { v = clamp(v, 1, size - 2); return v % 2 ? v : v - 1; };

  AV.GridView = class {
    constructor(el, onChange, cellSize) {
      this.el = el;
      this.onChange = onChange;
      this.cellSize = cellSize || 26;   // preferred cell width in px; the grid fits as many as it can
      this.tool = 'wall';
      this.walls = new Set();
      this.weights = new Set();
      this.rows = this.cols = 0;
      this.applied = -1;
      this.cur = -1;
      el.className = 'canvas canvas-grid';
      el.innerHTML = '<div class="grid"></div>';
      this.grid = el.firstChild;
      this.build();
      this.bind();
      this.ro = new ResizeObserver(() => {
        clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(() => { if (this.build()) this.onChange(); }, 150);
      });
      this.ro.observe(el);
    }

    destroy() { this.ro.disconnect(); clearTimeout(this.resizeTimer); this.el.innerHTML = ''; }

    model() {
      return { rows: this.rows, cols: this.cols, walls: this.walls, weights: this.weights,
               start: this.start, target: this.target };
    }

    // Fit the grid to the space available. Returns true if its shape changed.
    build() {
      const cs = getComputedStyle(this.el);
      const W = this.el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 4;
      const H = this.el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 4;
      if (W <= 0 || H <= 0) return false;
      const want = W < 520 ? Math.max(12, Math.round(this.cellSize * 0.75)) : this.cellSize;
      let cols = clamp(Math.floor((W + GAP) / (want + GAP)), 7, 81);
      let rows = clamp(Math.floor((H + GAP) / (want + GAP)), 5, 51);
      if (cols % 2 === 0) cols--;
      if (rows % 2 === 0) rows--;
      const size = Math.floor(Math.min((W - GAP * (cols - 1)) / cols, (H - GAP * (rows - 1)) / rows));
      this.grid.style.setProperty('--cs', size + 'px');
      if (rows === this.rows && cols === this.cols) return false;

      // Keep whatever was drawn that still fits in the new shape.
      const oc = this.cols;
      const remap = (set) => {
        const out = new Set();
        for (const i of set) {
          const r = Math.floor(i / oc), c = i % oc;
          if (r < rows && c < cols) out.add(r * cols + c);
        }
        return out;
      };
      if (oc) {
        const move = (i) => clamp(Math.floor(i / oc), 0, rows - 1) * cols + clamp(i % oc, 0, cols - 1);
        this.walls = remap(this.walls);
        this.weights = remap(this.weights);
        this.start = move(this.start);
        this.target = move(this.target);
        if (this.start === this.target) this.target = this.start === 0 ? 1 : this.start - 1;
      } else {
        const mid = odd((rows - 1) >> 1, rows);
        this.start = mid * cols + odd(Math.round(cols * 0.2), cols);
        this.target = mid * cols + odd(Math.round(cols * 0.8), cols);
      }
      this.rows = rows;
      this.cols = cols;
      this.walls.delete(this.start); this.walls.delete(this.target);
      this.weights.delete(this.start); this.weights.delete(this.target);

      this.grid.style.gridTemplateColumns = 'repeat(' + cols + ', var(--cs))';
      this.grid.innerHTML = '';
      this.cells = [];
      for (let i = 0; i < rows * cols; i++) {
        const c = document.createElement('div');
        c.dataset.i = i;
        this.grid.appendChild(c);
        this.cells.push(c);
      }
      this.paintBase();
      return true;
    }

    // Change how big the cells are (and so how many fit). Drawings are kept where they still fit.
    setCellSize(px) {
      this.cellSize = px;
      if (this.build()) this.onChange();
    }

    // Reset every cell to its base look (this also wipes any search colouring).
    paintBase() {
      this.grid.classList.remove('anim');
      for (let i = 0; i < this.cells.length; i++) {
        this.cells[i].className = 'cell' + (i === this.start ? ' start' : i === this.target ? ' target'
          : this.walls.has(i) ? ' wall' : this.weights.has(i) ? ' weight' : '');
      }
      this.applied = -1;
      this.cur = -1;
    }

    resetRun() { this.paintBase(); }

    // Show the search as it stood at step k.
    render(k, steps) {
      if (k < this.applied) this.paintBase();
      this.grid.classList.toggle('anim', k - this.applied <= 3);
      for (let s = this.applied + 1; s <= k; s++) {
        const st = steps[s];
        if (st.frontier) for (const i of st.frontier) this.cells[i].classList.add('frontier');
        if (st.visit != null) { this.cells[st.visit].classList.remove('frontier'); this.cells[st.visit].classList.add('visited'); }
        if (st.path) for (const i of st.path) this.cells[i].classList.add('path');
      }
      this.applied = k;
      if (this.cur >= 0) this.cells[this.cur].classList.remove('current');
      this.cur = steps[k].cur != null ? steps[k].cur : -1;
      if (this.cur >= 0) this.cells[this.cur].classList.add('current');
    }

    changed() { this.paintBase(); this.onChange(); }

    bind() {
      const hit = (e) => {
        const t = document.elementFromPoint(e.clientX, e.clientY);
        return t && t.parentNode === this.grid ? +t.dataset.i : -1;
      };
      this.grid.addEventListener('pointerdown', (e) => {
        const i = hit(e);
        if (i < 0) return;
        e.preventDefault();
        this.grid.setPointerCapture(e.pointerId);
        const erasing = this.tool === 'erase' || (this.tool === 'wall' && this.walls.has(i)) ||
                        (this.tool === 'weight' && this.weights.has(i));
        this.drag = i === this.start ? 'start' : i === this.target ? 'target' : erasing ? 'erase' : 'paint';
        this.lastHit = -1;
        this.paint(i);
      });
      this.grid.addEventListener('pointermove', (e) => {
        if (!this.drag) return;
        const i = hit(e);
        if (i >= 0 && i !== this.lastHit) this.paint(i);
      });
      const end = () => { this.drag = null; };
      this.grid.addEventListener('pointerup', end);
      this.grid.addEventListener('pointercancel', end);
    }

    paint(i) {
      this.lastHit = i;
      if (this.drag === 'start' || this.drag === 'target') {
        if (i === this.start || i === this.target) return;
        this.walls.delete(i); this.weights.delete(i);
        this[this.drag] = i;
      } else {
        if (i === this.start || i === this.target) return;
        this.walls.delete(i); this.weights.delete(i);
        if (this.drag === 'paint') (this.tool === 'weight' ? this.weights : this.walls).add(i);
      }
      this.changed();
    }

    clear() { this.walls.clear(); this.weights.clear(); this.changed(); }

    randomWalls() {
      this.walls.clear(); this.weights.clear();
      for (let i = 0; i < this.rows * this.cols; i++) {
        if (i !== this.start && i !== this.target && Math.random() < 0.28) this.walls.add(i);
      }
      this.changed();
    }

    // A "perfect" maze: carve corridors through a solid block so that exactly one
    // route joins any two open cells.
    maze() {
      const { rows, cols } = this;
      this.weights.clear();
      this.walls = new Set();
      for (let i = 0; i < rows * cols; i++) this.walls.add(i);
      const open = (r, c) => this.walls.delete(r * cols + c);
      const stack = [[1, 1]];
      open(1, 1);
      while (stack.length) {
        const [r, c] = stack[stack.length - 1];
        const next = [[r - 2, c], [r + 2, c], [r, c - 2], [r, c + 2]].filter(([nr, nc]) =>
          nr > 0 && nc > 0 && nr < rows - 1 && nc < cols - 1 && this.walls.has(nr * cols + nc));
        if (!next.length) { stack.pop(); continue; }
        const [nr, nc] = next[Math.floor(Math.random() * next.length)];
        open((r + nr) / 2, (c + nc) / 2);
        open(nr, nc);
        stack.push([nr, nc]);
      }
      // Corridors live on odd rows and columns, so move the endpoints onto one.
      const snap = (i) => odd(Math.floor(i / cols), rows) * cols + odd(i % cols, cols);
      this.start = snap(this.start);
      this.target = snap(this.target);
      if (this.start === this.target) this.target = (rows - 2) * cols + (cols - 2);
      if (this.start === this.target) this.start = cols + 1;
      this.changed();
    }
  };
})();
