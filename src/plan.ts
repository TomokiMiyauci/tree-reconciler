import type { VNode } from "./tree.ts";
import type { Counterparts } from "./relation.ts";

// 目標の並びの1要素。旧に対応があれば matched、なければ added
export type Placement =
  | { readonly tag: "matched"; readonly prev: VNode; readonly next: VNode }
  | { readonly tag: "added"; readonly next: VNode };

export interface ChildrenPlan {
  readonly prevParent: VNode;
  readonly nextParent: VNode;
  readonly arrangement: readonly Placement[]; // 目標の並び(順序に意味がある)
  readonly removed: readonly VNode[]; // 目標の並びに現れない旧の子(導出値)
}

export function plan(counterparts: Counterparts): ChildrenPlan[] {
  const plans: ChildrenPlan[] = [];

  for (const [nextParent, prevParent] of counterparts) {
    const arrangement: Placement[] = nextParent.children.map((next) => {
      const prev = counterparts.get(next);
      return prev ? { tag: "matched", prev, next } : { tag: "added", next };
    });

    const keptPrev = new Set<VNode>();
    for (const placement of arrangement) {
      if (placement.tag === "matched") keptPrev.add(placement.prev);
    }
    const removed = prevParent.children.filter((child) => !keptPrev.has(child));

    const unchanged =
      removed.length === 0 &&
      arrangement.length === prevParent.children.length &&
      arrangement.every(
        (placement, index) =>
          placement.tag === "matched" &&
          placement.prev === prevParent.children[index],
      );
    if (!unchanged) {
      plans.push({ prevParent, nextParent, arrangement, removed });
    }
  }
  return plans;
}
