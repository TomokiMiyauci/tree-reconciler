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

export type Assign = (
  prev: readonly VNode[],
  next: readonly VNode[],
) => readonly Pair[];

// 方針: 同じ key の旧の子を出現順に並べ、新の子を先頭から見て、
//       同じ key で未使用の最初の旧の子と対にする
export const assignByKey: Assign = (prev, next) => {
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
};

export function relate(
  prev: VNode,
  next: VNode,
  assign: Assign = assignByKey,
): Relation {
  const pairs = new Set<Pair>();
  const stack: Pair[] = [];

  if (prev.key === next.key) {
    const root = { prev, next };
    pairs.add(root);
    stack.push(root);
  }

  while (stack.length) {
    const parent = stack.pop()!;
    const prevKids = new Set(parent.prev.children);
    const nextKids = new Set(parent.next.children);
    const usedPrev = new Set<VNode>();
    const usedNext = new Set<VNode>();

    for (const q of assign(parent.prev.children, parent.next.children)) {
      if (!prevKids.has(q.prev) || !nextKids.has(q.next))
        throw new Error("not a child pair");
      if (usedPrev.has(q.prev) || usedNext.has(q.next))
        throw new Error("not one-to-one");
      if (q.prev.key !== q.next.key) throw new Error("pair has different key");
      usedPrev.add(q.prev);
      usedNext.add(q.next);
      pairs.add(q);
      stack.push(q);
    }
  }
  return { prev, next, pairs };
}
