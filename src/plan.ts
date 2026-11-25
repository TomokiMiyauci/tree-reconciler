import type { VNode } from "./tree.ts";
import type { Pair, Relation } from "./relation.ts";

export type Slot<T> =
  | { readonly tag: "kept"; readonly prev: VNode<T>; readonly next: VNode<T> }
  | { readonly tag: "fresh"; readonly next: VNode<T> };

export interface ChildrenPlan<T> {
  readonly parent: Pair<T>;
  readonly slots: readonly Slot<T>[];
  readonly dropped: readonly VNode<T>[];
}

export type StructPlan<T> =
  | { readonly kind: "patch"; readonly children: readonly ChildrenPlan<T>[] }
  | {
      readonly kind: "replace";
      readonly dropped: VNode<T> | null;
      readonly fresh: VNode<T> | null;
    };

export function replace<T>(
  dropped: VNode<T> | null,
  fresh: VNode<T> | null,
): StructPlan<T> {
  return { kind: "replace", dropped, fresh };
}

export function plan<T>(r: Relation<T>): StructPlan<T> {
  if (r.pairs.size === 0) return replace(r.prev, r.next);

  const prevOf = new Map<VNode<T>, VNode<T>>();
  for (const p of r.pairs) prevOf.set(p.next, p.prev);

  const children: ChildrenPlan<T>[] = [];
  for (const parent of r.pairs) {
    const slots: Slot<T>[] = parent.next.children.map((n) => {
      const p = prevOf.get(n);
      return p ? { tag: "kept", prev: p, next: n } : { tag: "fresh", next: n };
    });
    const keptPrev = new Set<VNode<T>>();
    for (const s of slots) if (s.tag === "kept") keptPrev.add(s.prev);
    const dropped = parent.prev.children.filter((c) => !keptPrev.has(c));

    const unchanged =
      dropped.length === 0 &&
      slots.length === parent.prev.children.length &&
      slots.every(
        (s, i) => s.tag === "kept" && s.prev === parent.prev.children[i],
      );
    if (!unchanged) children.push({ parent, slots, dropped });
  }

  return { kind: "patch", children };
}
