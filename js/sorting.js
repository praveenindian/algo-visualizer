/* Sorting algorithms.
 *
 * Each algorithm runs once, up front, and records a list of "steps". A step is a
 * complete picture of that moment: the order of the items, which ones are
 * highlighted, where the pointers are, which pseudocode line is running and a
 * plain-language sentence about it. The player then just moves through the list,
 * which is what makes stepping backwards and scrubbing possible.
 */
(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const AV = (root.AV = root.AV || {});

  function recorder(values) {
    const a = values.map((v, id) => ({ id, v }));
    const steps = [];
    const stats = { comparisons: 0, swaps: 0 };
    const sorted = new Set();
    const dim = new Set();
    let range = null;
    return {
      a, steps, stats, sorted, dim,
      v: (i) => a[i].v,
      range(lo, hi) { range = lo == null ? null : [lo, hi]; },
      swap(i, j) { const t = a[i]; a[i] = a[j]; a[j] = t; stats.swaps++; },
      snap(line, msg, marks, pointers) {
        const p = {};
        for (const k in pointers || {}) if (pointers[k] != null) p[k] = pointers[k];
        steps.push({ order: a.map((x) => x.id), marks: marks || {}, pointers: p, sorted: [...sorted],
                     dim: [...dim], range, line, msg, stats: { ...stats } });
      },
      finish(msg) {
        for (let i = 0; i < a.length; i++) sorted.add(i);
        range = null;
        this.snap(null, msg || 'Done. Every value is in its final place.');
        return steps;
      },
    };
  }
  AV.recorder = recorder;

  const bubble = {
    id: 'bubble', name: 'Bubble Sort', kind: 'sorting',
    tag: 'Swap neighbours that are out of order, again and again.',
    info: { best: 'O(n)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: 'Yes' },
    about: 'Bubble sort walks through the list comparing each pair of neighbours and swapping them if they are in the wrong order. After every pass the largest remaining value has "bubbled" to the end, so each pass can stop one position earlier. It is the easiest sort to understand and one of the slowest on large lists.',
    code: ['for i from 0 to n-1', '  swapped = false', '  for j from 0 to n-i-2', '    if a[j] > a[j+1]',
           '      swap a[j] and a[j+1]', '      swapped = true', '  if not swapped: stop'],
    run(values) {
      const r = recorder(values), n = values.length;
      r.snap(0, 'Walk through the list over and over, swapping any two neighbours that are in the wrong order.');
      for (let i = 0; i < n - 1; i++) {
        let swapped = false;
        r.range(0, n - 1 - i);
        for (let j = 0; j < n - i - 1; j++) {
          const x = r.v(j), y = r.v(j + 1), ptr = { j, 'j+1': j + 1 };
          r.stats.comparisons++;
          if (x > y) {
            r.snap(3, `Compare ${x} and ${y}. ${x} is bigger, so they are in the wrong order.`,
                   { [j]: 'compare', [j + 1]: 'compare' }, ptr);
            r.swap(j, j + 1);
            swapped = true;
            r.snap(4, `Swap them. ${x} moves one step to the right.`, { [j]: 'swap', [j + 1]: 'swap' }, ptr);
          } else {
            r.snap(3, `Compare ${x} and ${y}. They are already in order, so leave them.`,
                   { [j]: 'compare', [j + 1]: 'compare' }, ptr);
          }
        }
        r.sorted.add(n - 1 - i);
        r.snap(2, `Pass ${i + 1} is done. ${r.v(n - 1 - i)} was the largest unsorted value and is now in its final place.`);
        if (!swapped) {
          for (let k = 0; k < n; k++) r.sorted.add(k);
          r.range(null);
          r.snap(6, 'That pass made no swaps, so the rest is already in order. Stop early.');
          return r.steps;
        }
      }
      return r.finish();
    },
  };

  const selection = {
    id: 'selection', name: 'Selection Sort', kind: 'sorting',
    tag: 'Find the smallest remaining value and put it next.',
    info: { best: 'O(n²)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: 'No' },
    about: 'Selection sort splits the list into a sorted part on the left and an unsorted part on the right. It scans the unsorted part for the smallest value, swaps it to the front of that part, and repeats. It always does the same number of comparisons, but very few swaps.',
    code: ['for i from 0 to n-2', '  min = i', '  for j from i+1 to n-1', '    if a[j] < a[min]',
           '      min = j', '  swap a[i] and a[min]'],
    run(values) {
      const r = recorder(values), n = values.length;
      r.snap(0, 'Repeatedly find the smallest value that is not yet sorted and move it to the front.');
      for (let i = 0; i < n - 1; i++) {
        let min = i;
        r.range(i, n - 1);
        r.snap(1, `Start a new scan. Assume ${r.v(i)} is the smallest so far.`, { [i]: 'pivot' }, { i, min });
        for (let j = i + 1; j < n; j++) {
          r.stats.comparisons++;
          const marks = { [min]: 'pivot', [j]: 'compare' };
          if (r.v(j) < r.v(min)) {
            r.snap(3, `${r.v(j)} is smaller than the current smallest, ${r.v(min)}.`, marks, { i, j, min });
            min = j;
            r.snap(4, `Remember ${r.v(min)} as the new smallest.`, { [min]: 'pivot' }, { i, j, min });
          } else {
            r.snap(3, `${r.v(j)} is not smaller than ${r.v(min)}. Keep looking.`, marks, { i, j, min });
          }
        }
        if (min !== i) {
          const x = r.v(min), y = r.v(i);
          r.swap(i, min);
          r.sorted.add(i);
          r.snap(5, `${x} is the smallest remaining value. Swap it with ${y} to put it in place.`,
                 { [i]: 'swap', [min]: 'swap' }, { i });
        } else {
          r.sorted.add(i);
          r.snap(5, `${r.v(i)} is already the smallest remaining value, so it stays where it is.`, {}, { i });
        }
      }
      return r.finish();
    },
  };

  const insertion = {
    id: 'insertion', name: 'Insertion Sort', kind: 'sorting',
    tag: 'Take the next value and slide it back into the sorted part.',
    info: { best: 'O(n)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: 'Yes' },
    about: 'Insertion sort grows a sorted part at the left of the list, the way most people sort playing cards in their hand. It takes the next value and slides it leftward past every bigger value until it sits in the right spot. It is fast when the list is already nearly sorted.',
    code: ['for i from 1 to n-1', '  j = i', '  while j > 0 and a[j-1] > a[j]', '    swap a[j-1] and a[j]',
           '    j = j - 1'],
    run(values) {
      const r = recorder(values), n = values.length;
      r.snap(0, 'The first value on its own counts as sorted. Take each next value and slide it left into place.');
      for (let i = 1; i < n; i++) {
        let j = i;
        r.range(0, i);
        r.snap(1, `Take ${r.v(i)}. Everything to its left is already in order.`, { [i]: 'pivot' }, { i, j });
        while (j > 0) {
          r.stats.comparisons++;
          const x = r.v(j - 1), y = r.v(j);
          if (x > y) {
            r.snap(2, `${x} is bigger than ${y}, so ${y} has to move left.`,
                   { [j - 1]: 'compare', [j]: 'pivot' }, { i, j });
            r.swap(j - 1, j);
            j--;
            r.snap(3, `Slide ${y} one place to the left.`, { [j]: 'swap', [j + 1]: 'swap' }, { i, j });
          } else {
            r.snap(2, `${x} is not bigger than ${y}, so ${y} has found its place.`,
                   { [j - 1]: 'compare', [j]: 'pivot' }, { i, j });
            break;
          }
        }
        if (j === 0) r.snap(2, `${r.v(0)} reached the front. It is the smallest value so far.`, { 0: 'pivot' }, { i, j });
      }
      return r.finish();
    },
  };

  const merge = {
    id: 'merge', name: 'Merge Sort', kind: 'sorting', swapLabel: 'Moves',
    tag: 'Split in half, sort each half, then merge them.',
    info: { best: 'O(n log n)', avg: 'O(n log n)', worst: 'O(n log n)', space: 'O(n)', stable: 'Yes' },
    about: 'Merge sort keeps splitting the list in half until every piece has one value, which is sorted by definition. It then merges the pieces back together two at a time: compare the front value of each piece and take the smaller one. It is reliably fast on any input, at the cost of extra memory in the usual implementation.',
    code: ['mergeSort(lo, hi)', '  if lo >= hi: return', '  mid = (lo + hi) / 2', '  mergeSort(lo, mid)',
           '  mergeSort(mid+1, hi)', '  merge the two sorted halves:', '    compare the front of each half',
           '    move the smaller one into place'],
    run(values) {
      const r = recorder(values), n = values.length;
      r.snap(0, 'Keep splitting the list in half, then merge the halves back together in order.');
      (function sort(lo, hi) {
        if (lo >= hi) return;
        const mid = (lo + hi) >> 1;
        r.range(lo, hi);
        r.snap(2, `Split these ${hi - lo + 1} values into a left half of ${mid - lo + 1} and a right half of ${hi - mid}.`);
        sort(lo, mid);
        sort(mid + 1, hi);
        r.range(lo, hi);
        r.snap(5, `Both halves are sorted. Merge them into one sorted run of ${hi - lo + 1}.`, {},
               { left: lo, right: mid + 1 });
        let i = lo, j = mid + 1;
        while (i < j && j <= hi) {
          r.stats.comparisons++;
          const x = r.v(i), y = r.v(j);
          if (x <= y) {
            r.snap(6, `Front of each half: ${x} and ${y}. ${x} is not bigger, so it is already in the right spot.`,
                   { [i]: 'compare', [j]: 'compare' }, { left: i, right: j });
            i++;
          } else {
            r.snap(6, `Front of each half: ${x} and ${y}. ${y} is smaller, so it must come first.`,
                   { [i]: 'compare', [j]: 'compare' }, { left: i, right: j });
            r.a.splice(i, 0, r.a.splice(j, 1)[0]);
            r.stats.swaps++;
            r.snap(7, `Move ${y} in front of ${x}.`, { [i]: 'swap' },
                   { left: i + 1, right: j + 1 <= hi ? j + 1 : null });
            i++; j++;
          }
        }
        if (lo === 0 && hi === n - 1) return;
        r.snap(5, `This run of ${hi - lo + 1} is now sorted.`);
      })(0, n - 1);
      return r.finish();
    },
  };

  const quick = {
    id: 'quick', name: 'Quick Sort', kind: 'sorting',
    tag: 'Pick a pivot, put smaller values left and bigger values right.',
    info: { best: 'O(n log n)', avg: 'O(n log n)', worst: 'O(n²)', space: 'O(log n)', stable: 'No' },
    about: 'Quick sort picks one value as the pivot and rearranges the list so that everything smaller is on its left and everything bigger is on its right. The pivot is then in its final place, and the same idea is applied to each side. It is usually the fastest sort in practice, but a bad run of pivots (for example an already sorted list with this pivot choice) makes it slow.',
    code: ['quickSort(lo, hi)', '  if lo >= hi: return', '  pivot = a[hi]', '  i = lo', '  for j from lo to hi-1',
           '    if a[j] < pivot', '      swap a[i] and a[j]', '      i = i + 1',
           '  swap a[i] and a[hi]', '  quickSort(lo, i-1)', '  quickSort(i+1, hi)'],
    run(values) {
      const r = recorder(values), n = values.length;
      r.snap(0, 'Pick a pivot, split the list around it, then do the same to each side.');
      (function sort(lo, hi) {
        if (lo > hi) return;
        r.range(lo, hi);
        if (lo === hi) {
          r.sorted.add(lo);
          r.snap(1, `Only ${r.v(lo)} is left in this part, so it is already in its final place.`);
          return;
        }
        const p = r.v(hi);
        let i = lo;
        r.snap(2, `Use the last value, ${p}, as the pivot. Smaller values will go to its left.`,
               { [hi]: 'pivot' }, { i, pivot: hi });
        for (let j = lo; j < hi; j++) {
          r.stats.comparisons++;
          const x = r.v(j);
          if (x < p) {
            r.snap(5, `${x} is smaller than the pivot ${p}, so it belongs on the left side.`,
                   { [hi]: 'pivot', [j]: 'compare' }, { i, j, pivot: hi });
            if (i !== j) {
              const y = r.v(i);
              r.swap(i, j);
              r.snap(6, `Swap ${x} with ${y} to move it into the left side.`,
                     { [hi]: 'pivot', [i]: 'swap', [j]: 'swap' }, { i, j, pivot: hi });
            }
            i++;
          } else {
            r.snap(5, `${x} is not smaller than the pivot ${p}, so it stays on the right side.`,
                   { [hi]: 'pivot', [j]: 'compare' }, { i, j, pivot: hi });
          }
        }
        if (i !== hi) r.swap(i, hi);
        r.sorted.add(i);
        r.snap(8, `Place the pivot ${p} between the two sides. It is now in its final place.`,
               { [i]: 'pivot' }, { pivot: i });
        sort(lo, i - 1);
        sort(i + 1, hi);
      })(0, n - 1);
      return r.finish();
    },
  };

  const heap = {
    id: 'heap', name: 'Heap Sort', kind: 'sorting',
    tag: 'Build a heap, then keep removing the biggest value.',
    info: { best: 'O(n log n)', avg: 'O(n log n)', worst: 'O(n log n)', space: 'O(1)', stable: 'No' },
    about: 'Heap sort first rearranges the list into a max-heap: a tree stored inside the list where every parent is at least as big as its two children (the children of position i sit at 2i+1 and 2i+2). The biggest value is then always at the front. Swap it to the end, shrink the heap by one, repair the heap, and repeat.',
    code: ['build a max-heap from the list', 'for end from n-1 down to 1', '  swap a[0] and a[end]',
           '  sift a[0] down within the heap', 'siftDown(i):', '  pick the larger child of a[i]',
           '  if child > a[i]: swap and continue'],
    run(values) {
      const r = recorder(values), n = values.length;
      function sift(i, end) {
        for (;;) {
          const l = 2 * i + 1, rr = l + 1;
          if (l >= end) return;
          let c = l;
          if (rr < end) { r.stats.comparisons++; if (r.v(rr) > r.v(l)) c = rr; }
          r.stats.comparisons++;
          const x = r.v(i), y = r.v(c);
          if (y > x) {
            r.snap(6, `${x} is smaller than its larger child, ${y}. A parent must be the bigger one.`,
                   { [i]: 'compare', [c]: 'compare' }, { parent: i, child: c });
            r.swap(i, c);
            r.snap(6, `Swap them, then keep checking ${x} against its new children.`,
                   { [i]: 'swap', [c]: 'swap' }, { parent: i, child: c });
            i = c;
          } else {
            r.snap(6, `${x} is at least as big as its children, so it can stay here.`,
                   { [i]: 'compare', [c]: 'compare' }, { parent: i, child: c });
            return;
          }
        }
      }
      r.snap(0, 'First rearrange the list into a max-heap, where every parent is at least as big as its children.');
      for (let i = (n >> 1) - 1; i >= 0; i--) sift(i, n);
      r.snap(0, `The heap is built. The biggest value, ${r.v(0)}, is at the front.`, { 0: 'pivot' });
      for (let end = n - 1; end >= 1; end--) {
        const x = r.v(0);
        r.swap(0, end);
        r.sorted.add(end);
        r.range(0, end - 1);
        r.snap(2, `Swap the biggest value, ${x}, to the end. It is now in its final place.`,
               { 0: 'swap', [end]: 'swap' });
        sift(0, end);
      }
      return r.finish();
    },
  };

  AV.sorting = [bubble, selection, insertion, merge, quick, heap];
})();
