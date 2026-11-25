import type { VNode } from "./tree.ts";
import type { Pair, Relation } from "./relation.ts";

export type Slot =
  | { readonly tag: "kept"; readonly prev: VNode; readonly next: VNode }
  | { readonly tag: "fresh"; readonly next: VNode };

export interface ChildrenPlan {
  readonly parent: Pair;
  readonly slots: readonly Slot[];
  readonly dropped: readonly VNode[];
}

export type StructPlan =
  | { readonly kind: "patch"; readonly children: readonly ChildrenPlan[] }
  | {
      readonly kind: "replace";
      readonly dropped: VNode | null;
      readonly fresh: VNode | null;
    };

export function replace(
  dropped: VNode | null,
  fresh: VNode | null,
): StructPlan {
  return { kind: "replace", dropped, fresh };
}

export function plan(r: Relation): StructPlan {
  if (r.pairs.size === 0) return replace(r.prev, r.next);

  const prevOf = new Map<VNode, VNode>();
  for (const p of r.pairs) prevOf.set(p.next, p.prev);

  const children: ChildrenPlan[] = [];
  for (const parent of r.pairs) {
    const slots: Slot[] = parent.next.children.map((n) => {
      const p = prevOf.get(n);
      return p ? { tag: "kept", prev: p, next: n } : { tag: "fresh", next: n };
    });
    const keptPrev = new Set<VNode>();
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
