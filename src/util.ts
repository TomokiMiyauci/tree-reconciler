import type { StructOp } from "./script.ts";
import type { Branch } from "./tree.ts";

/**
 * Generates structural operations for a transition between two root states.
 *
 * Removes the previous root, if present, and creates the next root, if present.
 *
 * @param pair The previous and next root states.
 * @returns The structural operations required for the transition.
 */
export type RootPair = {
  /** The previous root, or `null` if no root exists. */
  readonly prev: Branch | null;
  /** The next root, or `null` if no root will exist. */
  readonly next: Branch | null;
};

/**
 * Generates structural operations for a transition between two root states.
 *
 * @param pair The previous and next root states.
 * @returns The structural operations required for the transition.
 */
export function rootOperations(pair: RootPair): StructOp[] {
  const { prev, next } = pair;
  const operations: StructOp[] = [];

  if (prev) operations.push({ kind: "remove", node: prev });

  if (next)
    operations.push({
      kind: "create",
      node: next,
      at: { before: null, parent: null },
    });

  return operations;
}
