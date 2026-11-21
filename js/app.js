/* Wires everything together: the algorithm list, the two views, the player and
 * the side panel. */
(function () {
  const AV = window.AV;
  const $ = (s) => document.querySelector(s);
  const el = (tag, attrs, text) => {
    const e = document.createElement(tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  };

  const ALGOS = [...AV.sorting, ...AV.searching, ...AV.pathfinding];
  const GROUPS = [['sorting', 'Sorting'], ['searching', 'Searching'], ['pathfinding', 'Pathfinding']];
  const LEGENDS = {
    sorting: [['', 'Unsorted'], ['compare', 'Comparing'], ['swap', 'Swapping or moving'],
              ['pivot', 'Pivot or selected'], ['sorted', 'In final place']],
    searching: [['', 'Not checked yet'], ['compare', 'Checking'], ['dim', 'Ruled out'], ['sorted', 'Found']],
    pathfinding: [['start', 'Start'], ['target', 'Target'], ['wall', 'Wall'],
                  ['weight', 'Weight (costs ' + AV.WEIGHT_COST + ')'], ['frontier', 'Waiting to be explored'],
                  ['visited', 'Explored'], ['path', 'Path']],
  };
  // [delay between steps in ms, steps per tick]
  const SPEEDS = [[900, 1], [450, 1], [170, 1], [55, 1], [16, 2]];
  const PATTERNS = [['random', 'Random'], ['nearly', 'Nearly sorted'], ['reversed', 'Reversed'],
                    ['few', 'Few unique values']];

  // Cell widths in px for the grid size slider, from fewest cells to most.
  const CELL_SIZES = [44, 36, 30, 26, 22, 18, 15];
  const state = { algo: null, size: 16, pattern: 'random', values: [], sortedValues: [], target: null,
                  gridLevel: 3 };
  const canvas = $('#canvas');
  let arrayView = null, gridView = null;

  // ------------------------------------------------------------- input data
  const rnd = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

  function makeValues(n, pattern) {
    let a;
    if (pattern === 'few') {
      const pool = [rnd(12, 30), rnd(35, 55), rnd(60, 78), rnd(82, 98)];
      a = Array.from({ length: n }, () => pool[rnd(0, 3)]);
    } else if (pattern === 'random') {
      a = Array.from({ length: n }, () => rnd(6, 98));
    } else {
      a = Array.from({ length: n }, (_, i) => Math.round(8 + (i * 90) / Math.max(1, n - 1)));
      if (pattern === 'reversed') a.reverse();
      if (pattern === 'nearly') {
        for (let k = 0; k < Math.max(1, Math.round(n / 8)); k++) {
          const i = rnd(0, n - 2);
          [a[i], a[i + 1]] = [a[i + 1], a[i]];
        }
      }
    }
    return a;
  }

  function newArray() {
    const searching = state.algo.kind === 'searching';
    state.values = makeValues(state.size, searching ? 'random' : state.pattern);
    state.sortedValues = [...state.values].sort((x, y) => x - y);
    state.target = state.values[rnd(0, state.values.length - 1)];
    const t = $('#targetInput');
    if (t) t.value = state.target;
  }

  // ------------------------------------------------------------------ player
  const player = new AV.Player(renderFrame, (playing) => {
    $('#btnPlay').classList.toggle('is-playing', playing);
    $('#btnPlay').setAttribute('aria-label', playing ? 'Pause' : 'Play');
  });

  function renderFrame(step, i, total, jump) {
    const a = state.algo;
    if (a.kind === 'pathfinding') gridView.render(i, player.steps);
    else {
      const opts = { target: a.kind === 'searching' ? state.target : null };
      if (jump) arrayView.instant(() => arrayView.render(step, opts));
      else arrayView.render(step, opts);
    }

    $('#msg').textContent = step.msg;
    document.querySelectorAll('#code li').forEach((li, n) => li.classList.toggle('on', n === step.line));

    const s = step.stats;
    const stats = a.kind === 'pathfinding'
      ? [[s.explored, 'Explored'], [s.pathLen == null ? '–' : s.pathLen, 'Path steps'],
         [s.pathCost == null ? '–' : s.pathCost, 'Path cost']]
      : a.kind === 'searching' ? [[s.comparisons, 'Checks']]
      : [[s.comparisons, 'Comparisons'], [s.swaps, a.swapLabel || 'Swaps']];
    $('#stats').innerHTML = stats.map(([v, label]) =>
      '<div class="stat"><b>' + v + '</b><span>' + label + '</span></div>').join('');

    const scrub = $('#scrub');
    scrub.max = total - 1;
    scrub.value = i;
    scrub.style.setProperty('--p', (total > 1 ? (i / (total - 1)) * 100 : 0) + '%');
    $('#count').textContent = 'Step ' + i + ' of ' + (total - 1);
  }

  // Run the current algorithm on the current input and load its steps.
  function recompute(keepEnd) {
    const a = state.algo, wasAtEnd = keepEnd && player.atEnd;
    let steps;
    if (a.kind === 'pathfinding') {
      gridView.resetRun();
      steps = a.run(gridView.model());
    } else {
      const values = a.needsSorted ? state.sortedValues : state.values;
      arrayView.setData(values);
      steps = a.run(values, { target: state.target });
    }
    player.load(steps, wasAtEnd);
  }

  // ----------------------------------------------------------------- toolbar
  function sizeControl() {
    const label = el('label', {}, 'Size');
    const input = el('input', { type: 'range', min: 5, max: 64, value: state.size, 'aria-label': 'Number of values' });
    const val = el('span', { class: 'val' }, state.size);
    const fill = () => input.style.setProperty('--p', ((state.size - 5) / 59) * 100 + '%');
    fill();
    input.addEventListener('input', () => {
      state.size = +input.value; val.textContent = state.size; fill();
      newArray(); recompute();
    });
    label.append(input, val);
    return label;
  }

  function button(text, onClick, cls) {
    const b = el('button', { class: 'btn' + (cls ? ' ' + cls : ''), type: 'button' }, text);
    b.addEventListener('click', onClick);
    return b;
  }

  function buildToolbar() {
    const bar = $('#toolbar'), kind = state.algo.kind;
    bar.innerHTML = '';
    if (kind === 'sorting') {
      const label = el('label', {}, 'Input');
      const sel = el('select', { 'aria-label': 'Starting order' });
      for (const [v, t] of PATTERNS) sel.append(el('option', { value: v }, t));
      sel.value = state.pattern;
      sel.addEventListener('change', () => { state.pattern = sel.value; newArray(); recompute(); });
      label.append(sel);
      bar.append(sizeControl(), label, button('New array', () => { newArray(); recompute(); }));
    } else if (kind === 'searching') {
      const label = el('label', {}, 'Target');
      const input = el('input', { type: 'number', id: 'targetInput', min: 1, max: 99, value: state.target });
      input.addEventListener('change', () => {
        state.target = Math.max(1, Math.min(99, Math.round(+input.value) || 1));
        input.value = state.target;
        recompute();
      });
      label.append(input);
      bar.append(sizeControl(), label,
        button('Random target', () => {
          state.target = state.values[rnd(0, state.values.length - 1)];
          input.value = state.target; recompute();
        }),
        button('New array', () => { newArray(); recompute(); }),
        el('span', { class: 'hint' }, 'Type a value that is not in the list to see a failed search.'));
    } else {
      const seg = el('div', { class: 'seg', role: 'group', 'aria-label': 'Drawing tool' });
      for (const [tool, text] of [['wall', 'Wall'], ['weight', 'Weight'], ['erase', 'Erase']]) {
        const b = el('button', { type: 'button', 'aria-pressed': gridView.tool === tool }, text);
        b.addEventListener('click', () => {
          gridView.tool = tool;
          seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b));
        });
        seg.append(b);
      }
      const sizeLabel = el('label', {}, 'Grid size');
      const size = el('input', { type: 'range', min: 0, max: CELL_SIZES.length - 1, value: state.gridLevel,
                                 'aria-label': 'Grid size: left for fewer, larger cells; right for more, smaller cells' });
      const fill = () => size.style.setProperty('--p', (state.gridLevel / (CELL_SIZES.length - 1)) * 100 + '%');
      fill();
      size.addEventListener('input', () => {
        state.gridLevel = +size.value; fill();
        gridView.setCellSize(CELL_SIZES[state.gridLevel]);
      });
      sizeLabel.append(size);
      bar.append(seg, sizeLabel, button('Maze', () => gridView.maze()),
        button('Random walls', () => gridView.randomWalls()), button('Clear', () => gridView.clear()),
        el('span', { class: 'hint' }, 'Drag on the grid to draw. Drag the start and target to move them.'));
    }
  }

  // ------------------------------------------------------- choose algorithm
  function chip(label, value) {
    const c = el('span', { class: 'chip' }, label + ' ');
    c.append(el('b', {}, value));
    return c;
  }

  function select(id, startStep) {
    const a = ALGOS.find((x) => x.id === id) || ALGOS[0];
    const prevKind = state.algo && state.algo.kind;
    player.pause();
    state.algo = a;

    document.querySelectorAll('.nav-item').forEach((b) => b.setAttribute('aria-current', b.dataset.id === a.id));
    $('#algoName').textContent = a.name;
    $('#algoTag').textContent = a.tag;
    $('#about').textContent = a.about;
    document.title = a.name + ' · Algorithm Visualizer';
    try { history.replaceState(null, '', '#' + a.id); } catch (e) {}

    const info = a.info, chips = $('#complexity');
    chips.innerHTML = '';
    if (a.kind === 'pathfinding') {
      chips.append(chip('Time', info.time), chip('Shortest path', info.shortest), chip('Weights', info.weights));
    } else {
      chips.append(chip('Best', info.best), chip('Average', info.avg), chip('Worst', info.worst), chip('Space', info.space));
      if (info.stable) chips.append(chip('Stable', info.stable));
    }

    const code = $('#code');
    code.innerHTML = '';
    for (const line of a.code) code.append(el('li', {}, line));

    $('#legend').innerHTML = LEGENDS[a.kind].map(([cls, text]) =>
      '<span><i class="' + (cls ? 'l-' + cls : '') + '"></i>' + text + '</span>').join('');

    // Swap the drawing surface only when moving between lists and the grid.
    const wantGrid = a.kind === 'pathfinding';
    if (wantGrid && !gridView) {
      if (arrayView) { arrayView.destroy(); arrayView = null; }
      gridView = new AV.GridView(canvas, () => recompute(true), CELL_SIZES[state.gridLevel]);
    } else if (!wantGrid && !arrayView) {
      if (gridView) { gridView.destroy(); gridView = null; }
      arrayView = new AV.ArrayView(canvas);
    }
    // Sorting algorithms share one array so they can be compared on the same input.
    if (!wantGrid && (prevKind !== a.kind || !state.values.length)) newArray();

    buildToolbar();
    recompute();
    if (startStep) player.seek(startStep, true);
  }

  function buildNav() {
    const nav = $('#nav');
    for (const [kind, title] of GROUPS) {
      const group = el('div', { class: 'nav-group' });
      group.append(el('div', { class: 'nav-title' }, title));
      for (const a of ALGOS.filter((x) => x.kind === kind)) {
        const b = el('button', { class: 'nav-item', type: 'button', 'data-id': a.id }, a.name);
        b.addEventListener('click', () => select(a.id));
        group.append(b);
      }
      nav.append(group);
    }
  }

  // --------------------------------------------------------------- controls
  function setSpeed(level) {
    const [delay, stride] = SPEEDS[level - 1];
    player.delay = delay;
    player.stride = stride;
    document.documentElement.style.setProperty('--dur', Math.round(Math.min(280, delay * 0.75)) + 'ms');
    $('#speed').style.setProperty('--p', ((level - 1) / 4) * 100 + '%');
  }

  $('#btnPlay').addEventListener('click', () => player.toggle());
  $('#btnBack').addEventListener('click', () => player.step(-1));
  $('#btnFwd').addEventListener('click', () => player.step(1));
  $('#btnStart').addEventListener('click', () => { player.pause(); player.seek(0, true); });
  $('#btnEnd').addEventListener('click', () => { player.pause(); player.seek(player.last, true); });
  $('#scrub').addEventListener('input', (e) => { player.pause(); player.seek(+e.target.value, true); });
  $('#speed').addEventListener('input', (e) => setSpeed(+e.target.value));

  $('#themeBtn').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('av-theme', next); } catch (e) {}
  });

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = e.target.tagName;
    if (tag === 'SELECT' || (tag === 'INPUT' && e.target.type !== 'range')) return;
    if (e.key === ' ') {
      if (tag === 'BUTTON') return;          // let the focused button handle it
      e.preventDefault(); player.toggle();
    } else if (e.key === 'ArrowRight' && tag !== 'INPUT') { e.preventDefault(); player.step(1); }
    else if (e.key === 'ArrowLeft' && tag !== 'INPUT') { e.preventDefault(); player.step(-1); }
    else if (e.key === 'r' || e.key === 'R') {
      if (state.algo.kind === 'pathfinding') gridView.maze();
      else { newArray(); recompute(); }
    }
  });

  // ------------------------------------------------------------------- start
  buildNav();
  setSpeed(3);
  const [hashId, hashStep] = location.hash.slice(1).split('/');
  select(hashId || 'bubble', parseInt(hashStep, 10) || 0);
})();
