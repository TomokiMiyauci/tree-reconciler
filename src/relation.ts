import type { VNode } from "./tree.ts";

export interface Pair {
  readonly prev: VNode;
  readonly next: VNode;
}

export interface Relation {
  readonly prev: VNode;
  readonly next: VNode;
  readonly pairs: ReadonlySet<Pair>;
}

function pairSiblings(prev: readonly VNode[], next: readonly VNode[]): Pair[] {
  const queues = new Map<string, VNode[]>();

  for (const v of prev) {
    const q = queues.get(v.key);
    if (q) q.push(v);
    else queues.set(v.key, [v]);
  }
  const cursor = new Map<string, number>();

  const out: Pair[] = [];
  for (const n of next) {
    const q = queues.get(n.key);
    if (!q) continue;
    const i = cursor.get(n.key) ?? 0;
    if (i >= q.length) continue;
    cursor.set(n.key, i + 1);
    out.push({ prev: q[i], next: n });
  }
  return out;
}

export function relate(prev: VNode, next: VNode): Relation {
  const pairs = new Set<Pair>();
  const stack: Pair[] = [];

  if (prev.key === next.key) {
    const root = { prev, next };
    pairs.add(root);
    stack.push(root);
  }

  while (stack.length) {
    const parent = stack.pop()!;
    const siblings = pairSiblings(parent.prev.children, parent.next.children);

    for (const q of siblings) {
      pairs.add(q);
      stack.push(q);
    }
  }
  return { prev, next, pairs };
}
