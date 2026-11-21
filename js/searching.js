/* Searching algorithms. Same step format as sorting; "dim" marks values that
 * have been ruled out. */
(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const AV = (root.AV = root.AV || {});

  const linear = {
    id: 'linear', name: 'Linear Search', kind: 'searching',
    tag: 'Check every value in turn until the target turns up.',
    info: { best: 'O(1)', avg: 'O(n)', worst: 'O(n)', space: 'O(1)' },
    about: 'Linear search starts at the first value and checks each one in turn until it finds the target or runs out of values. It works on any list, sorted or not, but on average it has to look at half the list.',
    code: ['for i from 0 to n-1', '  if a[i] == target', '    return i', 'return not found'],
    run(values, opts) {
      const r = AV.recorder(values), n = values.length, target = opts.target;
      r.snap(0, `Looking for ${target}. Check each value from left to right.`);
      for (let i = 0; i < n; i++) {
        r.stats.comparisons++;
        if (r.v(i) === target) {
          r.snap(2, `${r.v(i)} matches the target. Found it at position ${i + 1} after ${i + 1} ${i ? 'checks' : 'check'}.`,
                 { [i]: 'found' }, { i });
          return r.steps;
        }
        r.snap(1, `${r.v(i)} is not ${target}. Move to the next value.`, { [i]: 'compare' }, { i });
        r.dim.add(i);
      }
      r.snap(3, `Checked all ${n} values and none is ${target}. It is not in the list.`);
      return r.steps;
    },
  };

  const binary = {
    id: 'binary', name: 'Binary Search', kind: 'searching', needsSorted: true,
    tag: 'On a sorted list, halve the search range with every check.',
    info: { best: 'O(1)', avg: 'O(log n)', worst: 'O(log n)', space: 'O(1)' },
    about: 'Binary search only works on a sorted list. It looks at the middle value: if that is the target, it is done; if the target is bigger, the whole left half can be thrown away; if smaller, the right half. Each check halves what is left, so even a million values need at most 20 checks.',
    code: ['lo = 0, hi = n-1', 'while lo <= hi', '  mid = (lo + hi) / 2', '  if a[mid] == target: return mid',
           '  if a[mid] < target: lo = mid + 1', '  else: hi = mid - 1', 'return not found'],
    run(values, opts) {
      const r = AV.recorder(values), n = values.length, target = opts.target;
      let lo = 0, hi = n - 1;
      r.range(lo, hi);
      r.snap(0, `Looking for ${target} in a sorted list. Start with the whole list as the search range.`, {}, { lo, hi });
      while (lo <= hi) {
        const mid = (lo + hi) >> 1, x = r.v(mid);
        r.stats.comparisons++;
        r.snap(2, `Look at the middle of the range: ${x}.`, { [mid]: 'compare' }, { lo, mid, hi });
        if (x === target) {
          r.snap(3, `${x} matches the target. Found it after ${r.stats.comparisons} ${r.stats.comparisons > 1 ? 'checks' : 'check'}.`,
                 { [mid]: 'found' }, { mid });
          return r.steps;
        }
        if (x < target) {
          for (let k = lo; k <= mid; k++) r.dim.add(k);
          lo = mid + 1;
          r.range(lo <= hi ? lo : null, hi);
          r.snap(4, `${x} is smaller than ${target}, so the target can only be to the right. Discard the left part.`,
                 {}, { lo: lo <= hi ? lo : null, hi: lo <= hi ? hi : null });
        } else {
          for (let k = mid; k <= hi; k++) r.dim.add(k);
          hi = mid - 1;
          r.range(lo <= hi ? lo : null, hi);
          r.snap(5, `${x} is bigger than ${target}, so the target can only be to the left. Discard the right part.`,
                 {}, { lo: lo <= hi ? lo : null, hi: lo <= hi ? hi : null });
        }
      }
      r.range(null);
      r.snap(6, `The search range is empty, so ${target} is not in the list.`);
      return r.steps;
    },
  };

  AV.searching = [linear, binary];
})();
