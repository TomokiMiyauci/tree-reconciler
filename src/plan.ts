import type { Branch } from "./tree.ts";
import type { Counterparts } from "./relation.ts";

/**
 * Describes how a child in the next tree relates to a child in the previous tree.
 */
export type Placement =
  | {
      /** The next child corresponds to an existing child in the previous tree. */
      readonly tag: "matched";
      /** The corresponding child in the previous tree. */
      readonly prev: Branch;
      /** The child in the next tree. */
      readonly next: Branch;
    }
  | {
      /** The next child has no corresponding child in the previous tree. */
      readonly tag: "unmatched";
      /** The child in the next tree. */
      readonly next: Branch;
    };

/**
 * Describes the target arrangement of children for a pair of corresponding parents.
 */
export interface ChildrenPlan {
  /** The parent in the previous tree. */
  readonly prevParent: Branch;
  /** The corresponding parent in the next tree. */
  readonly nextParent: Branch;
  /**
   * The target arrangement of children in the next tree.
   *
   * Each placement represents one child in the next tree, in its target order.
   */
  readonly arrangement: readonly Placement[];
}

/**
 * Creates plans for corresponding parents whose children have changed.
 *
 * Each plan describes the target arrangement of children in the next tree.
 * Parents whose children remain unchanged are omitted.
 *
 * @param counterparts The correspondence between branches in the next and previous trees.
 * @returns Plans for parents whose child arrangements have changed.
 */
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
