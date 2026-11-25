import type { VNode } from "./tree.ts";

export interface Identity<T> {
  key(a: T): string;
}

export interface Pair<T> {
  readonly prev: VNode<T>;
  readonly next: VNode<T>;
}

export interface Relation<T> {
  readonly prev: VNode<T>;
  readonly next: VNode<T>;
  readonly pairs: ReadonlySet<Pair<T>>;
}

// 子の割り当て(差し替え点)。出力はノードの対で、インデックスは出さない
export type Assign = <T>(
  prev: readonly VNode<T>[],
  next: readonly VNode<T>[],
  id: Identity<T>,
) => readonly Pair<T>[];

// 方針: 同じ key の旧の子を出現順に並べ、新の子を先頭から見て、
//       同じ key で未使用の最初の旧の子と対にする
export const assignByKey: Assign = <T>(
  prev: readonly VNode<T>[],
  next: readonly VNode<T>[],
  id: Identity<T>,
) => {
  const queues = new Map<string, VNode<T>[]>();
  for (const v of prev) {
    const k = id.key(v.identity);
    const q = queues.get(k);
    if (q) q.push(v);
    else queues.set(k, [v]);
  }
  const cursor = new Map<string, number>();

  const out: Pair<T>[] = [];
  for (const n of next) {
    const k = id.key(n.identity);
    const q = queues.get(k);
    if (!q) continue;
    const i = cursor.get(k) ?? 0;
    if (i >= q.length) continue;
    cursor.set(k, i + 1);
    out.push({ prev: q[i], next: n });
  }
  return out;
};

export function relate<T>(
  prev: VNode<T>,
  next: VNode<T>,
  id: Identity<T>,
  assign: Assign = assignByKey,
): Relation<T> {
  const pairs = new Set<Pair<T>>();
  const stack: Pair<T>[] = [];

  if (id.key(prev.identity) === id.key(next.identity)) {
    const root = { prev, next };
    pairs.add(root);
    stack.push(root);
  }

  while (stack.length) {
    const parent = stack.pop()!;
    const prevKids = new Set(parent.prev.children);
    const nextKids = new Set(parent.next.children);
    const usedPrev = new Set<VNode<T>>();
    const usedNext = new Set<VNode<T>>();

    // assign は差し替え部品なので、契約を境界で確認する
    for (const q of assign(parent.prev.children, parent.next.children, id)) {
      if (!prevKids.has(q.prev) || !nextKids.has(q.next))
        throw new Error("not a child pair");
      if (usedPrev.has(q.prev) || usedNext.has(q.next))
        throw new Error("not one-to-one");
      if (id.key(q.prev.identity) !== id.key(q.next.identity))
        throw new Error("pair has different key");
      usedPrev.add(q.prev);
      usedNext.add(q.next);
      pairs.add(q);
      stack.push(q);
    }
  }
  return { prev, next, pairs };
}
