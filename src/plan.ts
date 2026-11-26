import type { Branch } from "./tree.ts";
import type { Counterparts } from "./relation.ts";

// 目標の並びの1要素。旧に対応があれば matched、なければ added
export type Placement =
  | { readonly tag: "matched"; readonly prev: Branch; readonly next: Branch }
  | { readonly tag: "unmatched"; readonly next: Branch };

export interface ChildrenPlan {
  readonly prevParent: Branch;
  readonly nextParent: Branch;
  readonly arrangement: readonly Placement[]; // 目標の並び(順序に意味がある)
  readonly removed: readonly Branch[]; // 目標の並びに現れない旧の子(導出値)
}

export function plan(counterparts: Counterparts): ChildrenPlan[] {
  const plans: ChildrenPlan[] = [];

  for (const [nextParent, prevParent] of counterparts) {
    const arrangement: Placement[] = nextParent.children.map((next) => {
      const prev = counterparts.get(next);
      return prev ? { tag: "matched", prev, next } : { tag: "unmatched", next };
    });

    const keptPrev: ReadonlySet<Branch> = arrangement.reduce(
      matchedReducer,
      new Set(),
    );
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

function matchedReducer(set: Set<Branch>, placement: Placement): Set<Branch> {
  if (placement.tag === "matched") set.add(placement.prev);

  return set;
}
