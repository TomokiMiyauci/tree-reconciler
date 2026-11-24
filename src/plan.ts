import type { VNode } from "./tree";
import type { Pair, Relation } from "./relation";

export type Slot<T> =
  | { readonly tag: "kept"; readonly prev: VNode<T>; readonly next: VNode<T> }
  | { readonly tag: "fresh"; readonly next: VNode<T> };

export interface ChildrenPlan<T> {
  readonly parent: Pair<T>;
  readonly slots: readonly Slot<T>[]; // 新しい順序どおり(この順序だけが意味を持つ)
  readonly dropped: readonly VNode<T>[];
}
export interface StructPlan<T> {
  readonly plans: readonly ChildrenPlan<T>[];
} // 要素間は独立

export function plan<T>(r: Relation<T>): StructPlan<T> {
  const prevOf = new Map<VNode<T>, VNode<T>>(); // 索引。この層の内部
  for (const p of r.pairs) prevOf.set(p.next, p.prev);

  const plans: ChildrenPlan<T>[] = [];
  for (const parent of r.pairs) {
    const slots: Slot<T>[] = parent.next.children.map((n) => {
      const p = prevOf.get(n);
      return p ? { tag: "kept", prev: p, next: n } : { tag: "fresh", next: n };
    });
    const keptPrev = new Set<VNode<T>>();
    for (const s of slots) if (s.tag === "kept") keptPrev.add(s.prev);
    const dropped = parent.prev.children.filter((c) => !keptPrev.has(c));

    const same =
      dropped.length === 0 &&
      slots.length === parent.prev.children.length &&
      slots.every(
        (s, i) => s.tag === "kept" && s.prev === parent.prev.children[i],
      );
    if (!same) plans.push({ parent, slots, dropped });
  }
  return { plans };
}
