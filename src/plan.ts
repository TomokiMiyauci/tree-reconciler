import type { Branch } from "./tree.ts";
import type { Counterparts } from "./relation.ts";

export type Placement =
  | { readonly tag: "matched"; readonly prev: Branch; readonly next: Branch }
  | { readonly tag: "unmatched"; readonly next: Branch };

export interface ChildrenPlan {
  readonly prevParent: Branch;
  readonly nextParent: Branch;
  readonly arrangement: readonly Placement[];
}

export function plan(counterparts: Counterparts): ChildrenPlan[] {
  const plans: ChildrenPlan[] = [];

  for (const [nextParent, prevParent] of counterparts) {
    const arrangement: Placement[] = nextParent.children.map((next) => {
      const prev = counterparts.get(next);
      return prev ? { tag: "matched", prev, next } : { tag: "unmatched", next };
    });

    const unchanged =
      arrangement.length === prevParent.children.length &&
      arrangement.every(
        (placement, index) =>
          placement.tag === "matched" &&
          placement.prev === prevParent.children[index],
      );

    if (!unchanged) {
      plans.push({ prevParent, nextParent, arrangement });
    }
  }
  return plans;
}
