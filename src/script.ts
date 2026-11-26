import type { Branch } from "./tree.ts";
import type { Counterparts } from "./relation.ts";
import { plan, type ChildrenPlan } from "./plan.ts";

/**
 * Identifies a position relative to a parent branch or at the tree root.
 */
export type Anchor = {
  /** The parent branch, or `null` to identify the tree root. */
  readonly parent: Branch | null;
  /** The branch to insert before, or `null` to append among siblings. */
  readonly before: Branch | null;
};

/**
 * Describes a structural operation on a tree.
 */
export type StructOp =
  | { readonly kind: "create"; readonly node: Branch; readonly at: Anchor }
  | { readonly kind: "move"; readonly node: Branch; readonly to: Anchor }
  | { readonly kind: "remove"; readonly node: Branch };

/**
 * Represents two roots without correspondence.
 */
export type Pair = {
  /** The root of the previous tree. */
  readonly prev: Branch;
  /** The root of the next tree. */
  readonly next: Branch;
};

/**
 * Generates structural operations to transform the previous tree into the next tree.
 *
 * If the roots have no correspondence, the previous root is removed and the next
 * root is created. Otherwise, operations are generated for changed child arrangements.
 *
 * @param counterparts The correspondence between branches in the next and previous trees.
 * @param prevRoot The root of the previous tree.
 * @param nextRoot The root of the next tree.
 * @returns The structural operations required to produce the next tree.
 */
export function script(
  counterparts: Counterparts | null,
  prevRoot: Branch,
  nextRoot: Branch,
): StructOp[] {
  if (counterparts === null) {
    return scriptRoot({ prev: prevRoot, next: nextRoot });
  }

  const plans = plan(counterparts);

  return scriptChildren(plans);
}

/**
 * Generates structural operations to replace a root with another root.
 *
 * @param pair The previous and next roots without correspondence.
 * @returns The operations required to replace the root.
 */
export function scriptRoot(pair: Pair): StructOp[] {
  const ops: StructOp[] = [];

  ops.push({ kind: "remove", node: pair.prev });

  ops.push({
    kind: "create",
    node: pair.next,
    at: { parent: null, before: null },
  });

  return ops;
}

/**
 * Generates structural operations for a collection of child plans.
 *
 * Operations for each parent must be executed in their generated order.
 * Operations belonging to different parents are independent and may be reordered.
 *
 * @param plans The plans describing the target child arrangements.
 * @returns The structural operations required to produce those arrangements.
 */
function scriptChildren(plans: readonly ChildrenPlan[]): StructOp[] {
  const ops: StructOp[] = [];

  for (const childrenPlan of plans) scriptChildrenPlan(childrenPlan, ops);

  return ops;
}

/**
 * Generates structural operations for a single parent's child arrangement.
 *
 * @param plan The plan describing the target child arrangement.
 * @param ops The operation list to append to.
 */
function scriptChildrenPlan(
  { prevParent, nextParent, arrangement }: ChildrenPlan,
  ops: StructOp[],
): void {
  const prevIndex = new Map<Branch, number>(prevParent.children.map(pair));

  const sequence = arrangement.map((placement) => {
    if (placement.tag === "unmatched") return -1;

    const index = prevIndex.get(placement.prev)!;
    prevIndex.delete(placement.prev);

    return index;
  });

  for (const node of prevIndex.keys()) {
    ops.push({ kind: "remove", node });
  }

  const stable = stableSet(sequence);

  // Process from right to left, using the next sibling as the anchor.
  for (let index = arrangement.length - 1; index >= 0; index--) {
    const placement = arrangement[index];
    const anchor: Anchor = {
      parent: nextParent,
      before: arrangement[index + 1]?.next ?? null,
    };

    if (placement.tag === "unmatched") {
      ops.push({ kind: "create", node: placement.next, at: anchor });
    } else if (!stable[index]) {
      ops.push({ kind: "move", node: placement.next, to: anchor });
    }
  }
}

/**
 * Finds the positions belonging to a longest increasing subsequence.
 *
 * @param sequence The previous indices in target order. Negative values represent unmatched branches.
 * @returns A bitmap marking the positions belonging to a longest increasing subsequence.
 */
function stableSet(sequence: readonly number[]): Uint8Array {
  const tails: number[] = [];
  const back = new Int32Array(sequence.length).fill(-1);

  for (let index = 0; index < sequence.length; index++) {
    if (sequence[index] < 0) continue;

    let low = 0;
    let high = tails.length;

    while (low < high) {
      const middle = (low + high) >> 1;
      if (sequence[tails[middle]] < sequence[index]) low = middle + 1;
      else high = middle;
    }

    if (low > 0) back[index] = tails[low - 1];
    tails[low] = index;
  }

  const marks = new Uint8Array(sequence.length);

  for (
    let cursor = tails.length ? tails[tails.length - 1] : -1;
    cursor >= 0;
    cursor = back[cursor]
  ) {
    marks[cursor] = 1;
  }

  return marks;
}

/**
 * Creates a tuple from two values.
 */
function pair<T, U>(a: T, b: U): [T, U] {
  return [a, b];
}
