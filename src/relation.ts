import type { Branch } from "./tree.ts";

/**
 * Map for Next to Prev
 */
export type Counterparts = ReadonlyMap<Branch, Branch>;

/**
 * Pairs equivalent siblings in their occurrence order.
 *
 * For each node in the next siblings, pairs it with the first
 * unused node having the same key in the previous siblings.
 */
function pairSiblings(
  prevChildren: readonly Branch[],
  nextChildren: readonly Branch[],
): [next: Branch, prev: Branch][] {
  const queues = new Map<string, Branch[]>();

  for (const child of prevChildren) {
    const queue = queues.get(child.key);

    if (queue) queue.push(child);
    else queues.set(child.key, [child]);
  }

  const cursors = new Map<string, number>();

  const pairs: [Branch, Branch][] = [];

  for (const next of nextChildren) {
    const queue = queues.get(next.key);

    if (!queue) continue;

    const cursor = cursors.get(next.key) ?? 0;

    if (cursor >= queue.length) continue;

    cursors.set(next.key, cursor + 1);
    pairs.push([next, queue[cursor]]);
  }
  return pairs;
}

/**
 * Derives node correspondences between two trees.
 *
 * The root nodes are paired only when their keys are equal.
 * For each paired parent, its children are paired by key and
 * occurrence order. Descendants of unpaired nodes are not traversed.
 */
export function relate(
  prevRoot: Branch,
  nextRoot: Branch,
): Counterparts | null {
  if (prevRoot.key !== nextRoot.key) return null;

  const counterparts = new Map<Branch, Branch>([[nextRoot, prevRoot]]);
  const stack: [next: Branch, prev: Branch][] = [[nextRoot, prevRoot]];

  while (stack.length) {
    const [next, prev] = stack.pop()!;
    for (const pair of pairSiblings(prev.children, next.children)) {
      counterparts.set(pair[0], pair[1]);
      stack.push(pair);
    }
  }

  return counterparts;
}
