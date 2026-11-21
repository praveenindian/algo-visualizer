/* Pathfinding on a grid.
 *
 * A step here is a change, not a full picture: which cell was explored, which
 * cells joined the frontier, which cell joined the final path. The grid view
 * replays the changes up to the step being shown.
 *
 * Moving onto a normal cell costs 1. Moving onto a weight costs WEIGHT_COST.
 */
(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const AV = (root.AV = root.AV || {});
  const WEIGHT_COST = 5;
  AV.WEIGHT_COST = WEIGHT_COST;

  function helpers(g) {
    const { rows, cols, walls, weights } = g;
    return {
      cost: (i) => (weights.has(i) ? WEIGHT_COST : 1),
      neighbours(i) {
        const r = Math.floor(i / cols), c = i % cols, out = [];
        if (r > 0) out.push(i - cols);
        if (c < cols - 1) out.push(i + 1);
        if (r < rows - 1) out.push(i + cols);
        if (c > 0) out.push(i - 1);
        return out.filter((n) => !walls.has(n));
      },
      manhattan(a, b) {
        return Math.abs(Math.floor(a / cols) - Math.floor(b / cols)) + Math.abs((a % cols) - (b % cols));
      },
    };
  }

  // Append the "trace the path back" steps and the closing summary.
  function finishPath(g, h, steps, stats, parent, found, lineBack, summary) {
    if (!found) {
      steps.push({ line: null, stats: { ...stats },
                   msg: `Nothing left to explore and the target was never reached: it is walled off. ${stats.explored} cells were explored.` });
      return steps;
    }
    const path = [];
    for (let c = g.target; c !== undefined; c = parent.get(c)) path.push(c);
    path.reverse();
    let cost = 0;
    for (const c of path.slice(1)) cost += h.cost(c);
    path.forEach((c, k) => {
      steps.push({ path: [c], line: lineBack, stats: { ...stats },
                   msg: 'Target reached. Follow each cell back to the one it was reached from to draw the path.' });
    });
    stats.pathLen = path.length - 1;
    stats.pathCost = cost;
    steps.push({ line: null, stats: { ...stats }, msg: summary(stats) });
    return steps;
  }

  // Breadth-first and depth-first search differ only in which end of the list they take from.
  function uninformed(g, depthFirst) {
    const h = helpers(g), steps = [], stats = { explored: 0, pathLen: null, pathCost: null };
    const parent = new Map(), seen = new Set([g.start]), dist = new Map([[g.start, 0]]);
    const list = [g.start];
    let found = false;
    steps.push({ frontier: [g.start], line: 0, stats: { ...stats },
      msg: depthFirst
        ? 'Start at the green cell. Depth-first search follows one direction as far as it can, and only backs up when it is stuck.'
        : 'Start at the green cell. Breadth-first search explores in rings: every cell 1 step away, then every cell 2 steps away, and so on.' });
    while (list.length) {
      const cell = depthFirst ? list.pop() : list.shift();
      stats.explored++;
      if (cell === g.target) {
        steps.push({ visit: cell, cur: cell, line: 3, stats: { ...stats }, msg: 'This cell is the target.' });
        found = true;
        break;
      }
      const added = [];
      for (const nb of h.neighbours(cell)) {
        if (seen.has(nb)) continue;
        seen.add(nb); parent.set(nb, cell); dist.set(nb, dist.get(cell) + 1);
        list.push(nb); added.push(nb);
      }
      const d = dist.get(cell);
      steps.push({ visit: cell, cur: cell, frontier: added, line: added.length ? 7 : 4, stats: { ...stats },
        msg: (depthFirst ? `Explore the most recently found cell (${d} ${d === 1 ? 'step' : 'steps'} deep). `
                         : `Explore the oldest waiting cell (${d} ${d === 1 ? 'step' : 'steps'} from the start). `) +
             (added.length ? `Add its ${added.length} new ${added.length === 1 ? 'neighbour' : 'neighbours'} to the ${depthFirst ? 'stack' : 'queue'}.`
                           : 'It has no new neighbours.') });
    }
    return finishPath(g, h, steps, stats, parent, found, 8, (s) => depthFirst
      ? `Path found: ${s.pathLen} steps, cost ${s.pathCost}, after exploring ${s.explored} cells. Depth-first search takes the first path it finds, which is usually not the shortest.`
      : `Shortest path found: ${s.pathLen} steps, cost ${s.pathCost}, after exploring ${s.explored} cells. Breadth-first search counts steps and ignores weights.`);
  }

  // Dijkstra and A* differ only in how they rank the waiting cells.
  function bestFirst(g, useHeuristic) {
    const h = helpers(g), steps = [], stats = { explored: 0, pathLen: null, pathCost: null };
    const parent = new Map(), dist = new Map([[g.start, 0]]), done = new Set();
    const est = (c) => (useHeuristic ? h.manhattan(c, g.target) : 0);
    let open = [g.start], found = false;
    steps.push({ frontier: [g.start], line: 0, stats: { ...stats },
      msg: useHeuristic
        ? 'Start at the green cell. A* always explores the cell with the lowest total of cost so far plus the estimated distance still to go.'
        : 'Start at the green cell. Dijkstra always explores the waiting cell that is cheapest to reach from the start.' });
    while (open.length) {
      let best = 0;
      for (let k = 1; k < open.length; k++) {
        const a = open[k], b = open[best];
        const fa = dist.get(a) + est(a), fb = dist.get(b) + est(b);
        if (fa < fb || (fa === fb && est(a) < est(b))) best = k;
      }
      const cell = open.splice(best, 1)[0];
      if (done.has(cell)) continue;
      done.add(cell);
      stats.explored++;
      const d = dist.get(cell);
      if (cell === g.target) {
        steps.push({ visit: cell, cur: cell, line: 3, stats: { ...stats },
                     msg: `This cell is the target, reached at a cost of ${d}.` });
        found = true;
        break;
      }
      const added = [];
      let improved = 0;
      for (const nb of h.neighbours(cell)) {
        if (done.has(nb)) continue;
        const nd = d + h.cost(nb);
        if (!dist.has(nb)) added.push(nb);
        if (!dist.has(nb) || nd < dist.get(nb)) {
          dist.set(nb, nd); parent.set(nb, cell); open.push(nb); improved++;
        }
      }
      steps.push({ visit: cell, cur: cell, frontier: added, line: improved ? 7 : 6, stats: { ...stats },
        msg: (useHeuristic
          ? `Explore the most promising cell: cost so far ${d} + estimated ${est(cell)} to go = ${d + est(cell)}. `
          : `Explore the cheapest waiting cell (cost ${d} from the start). `) +
          (improved ? `Record a cheaper route to ${improved} ${improved === 1 ? 'neighbour' : 'neighbours'}.`
                    : 'None of its neighbours gets a cheaper route.') });
    }
    return finishPath(g, h, steps, stats, parent, found, 8, (s) =>
      `Cheapest path found: ${s.pathLen} steps, cost ${s.pathCost}, after exploring ${s.explored} cells.` +
      (useHeuristic ? ' The estimate steers A* toward the target, so it usually explores far fewer cells than Dijkstra.' : ''));
  }

  const bfs = {
    id: 'bfs', name: 'Breadth-First Search', kind: 'pathfinding',
    tag: 'Explore outward in rings. Finds the path with the fewest steps.',
    info: { time: 'O(V + E)', shortest: 'Yes (by steps)', weights: 'Ignored' },
    about: 'Breadth-first search keeps a queue of cells waiting to be explored. It always takes the oldest one, so it finishes everything 1 step from the start before anything 2 steps away. The first time it reaches the target is therefore along a path with the fewest possible steps. It does not understand weights: try adding some and compare the path cost with Dijkstra.',
    code: ['queue = [start]', 'while queue is not empty', '  cell = queue.removeFirst()',
           '  if cell == target: done', '  for each neighbour n of cell', '    if n is not seen',
           '      parent[n] = cell', '      queue.add(n)', 'walk parent[] back from target'],
    run: (g) => uninformed(g, false),
  };

  const dfs = {
    id: 'dfs', name: 'Depth-First Search', kind: 'pathfinding',
    tag: 'Go as deep as possible, back up when stuck. Path is not the shortest.',
    info: { time: 'O(V + E)', shortest: 'No', weights: 'Ignored' },
    about: 'Depth-first search keeps a stack instead of a queue, so it always continues from the cell it found most recently. That makes it charge down one corridor until it hits a dead end, then back up to the last junction. It will find a path if one exists, but usually a long, wandering one. It is good for exploring everything, such as solving a maze or checking what is connected.',
    code: ['stack = [start]', 'while stack is not empty', '  cell = stack.removeLast()',
           '  if cell == target: done', '  for each neighbour n of cell', '    if n is not seen',
           '      parent[n] = cell', '      stack.add(n)', 'walk parent[] back from target'],
    run: (g) => uninformed(g, true),
  };

  const dijkstra = {
    id: 'dijkstra', name: "Dijkstra's Algorithm", kind: 'pathfinding',
    tag: 'Always explore the cheapest cell to reach. Finds the cheapest path.',
    info: { time: 'O(E log V)', shortest: 'Yes (by cost)', weights: 'Used' },
    about: "Dijkstra's algorithm tracks the cheapest known cost to reach every cell. It repeatedly explores the unexplored cell with the lowest cost and checks whether going through it gives any neighbour a cheaper route. Because it always handles the cheapest cell first, a cell's cost is final once it is explored. With no weights it behaves like breadth-first search; add weights and it will route around them when that is cheaper.",
    code: ['cost[start] = 0; waiting = [start]', 'while waiting is not empty',
           '  cell = cheapest cell in waiting', '  if cell == target: done',
           '  for each neighbour n of cell', '    c = cost[cell] + stepCost(n)', '    if c < cost[n]',
           '      cost[n] = c; parent[n] = cell', 'walk parent[] back from target'],
    run: (g) => bestFirst(g, false),
  };

  const astar = {
    id: 'astar', name: 'A* Search', kind: 'pathfinding',
    tag: 'Like Dijkstra, but steered toward the target by an estimate.',
    info: { time: 'O(E log V)', shortest: 'Yes (by cost)', weights: 'Used' },
    about: 'A* improves on Dijkstra by also estimating how far each cell still is from the target (here, the number of rows plus columns between them). It explores the cell where cost so far plus that estimate is lowest, so it heads toward the target instead of spreading out evenly. As long as the estimate never overstates the real distance, the path it finds is still the cheapest.',
    code: ['cost[start] = 0; waiting = [start]', 'while waiting is not empty',
           '  cell = lowest cost + estimate', '  if cell == target: done',
           '  for each neighbour n of cell', '    c = cost[cell] + stepCost(n)', '    if c < cost[n]',
           '      cost[n] = c; parent[n] = cell', 'walk parent[] back from target'],
    run: (g) => bestFirst(g, true),
  };

  AV.pathfinding = [bfs, dfs, dijkstra, astar];
})();
