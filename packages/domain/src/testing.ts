import type { Machine } from './machine.js';

/** States reachable from `from` (inclusive), breadth-first. Test helper. */
export function reachable<S extends string>(m: Machine<S>, from: S): Set<S> {
  const seen = new Set<S>([from]);
  const queue: S[] = [from];
  for (let s = queue.shift(); s !== undefined; s = queue.shift()) {
    for (const t of m.targets(s)) {
      if (!seen.has(t)) {
        seen.add(t);
        queue.push(t);
      }
    }
  }
  return seen;
}
