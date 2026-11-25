import type { VNode } from "./tree.ts";

/**
 * A correspondence between nodes in the previous and next trees.
 */
export interface Pair {
  readonly prev: VNode;
  readonly next: VNode;
}

/**
 * The correspondence between two trees.
 */
export interface Relation {
  readonly prev: VNode;
  readonly next: VNode;
  readonly pairs: ReadonlySet<Pair>;
}

/**
 * Pairs equivalent siblings in their occurrence order.
 *
 * For each node in the next siblings, pairs it with the first
 * unused node having the same key in the previous siblings.
 */
function pairSiblings(prev: readonly VNode[], next: readonly VNode[]): Pair[] {
  const queues = new Map<string, VNode[]>();

  for (const node of prev) {
    const queue = queues.get(node.key);
    if (queue) queue.push(node);
    else queues.set(node.key, [node]);
  }

  const cursors = new Map<string, number>();
  const pairs: Pair[] = [];

  for (const nextNode of next) {
    const queue = queues.get(nextNode.key);
    if (!queue) continue;

    const index = cursors.get(nextNode.key) ?? 0;
    if (index >= queue.length) continue;

    cursors.set(nextNode.key, index + 1);
    pairs.push({ prev: queue[index], next: nextNode });
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
export function relate(prev: VNode, next: VNode): Relation {
  const pairs = new Set<Pair>();
  const stack: Pair[] = [];

  if (prev.key === next.key) {
    const rootPair = { prev, next };
    pairs.add(rootPair);
    stack.push(rootPair);
  }

  while (stack.length) {
    const parentPair = stack.pop()!;
    const childPairs = pairSiblings(
      parentPair.prev.children,
      parentPair.next.children,
    );

    for (const pair of childPairs) {
      pairs.add(pair);
      stack.push(pair);
    }
  }

  return { prev, next, pairs };
}
