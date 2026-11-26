/**
 * A branch in a tree structure.
 *
 * Each branch has a key and an ordered list of child branches.
 * A branch can belong to at most one parent.
 */
export class Branch {
  /** The key identifying this branch. */
  readonly key: string;

  /** The child branches. */
  readonly children: readonly Branch[];

  /** Whether this branch has already been adopted by a parent. */
  #adopted = false;

  private constructor(key: string, children: readonly Branch[]) {
    this.key = key;
    this.children = children;
  }

  /**
   * Creates a branch with the given key and children.
   *
   * Each child must be unique within the given list and must not
   * already belong to another parent.
   *
   * @param key The key identifying the branch.
   * @param children The child branches.
   * @returns The newly created branch.
   * @throws {Error} If a child appears more than once or already belongs to a parent.
   */
  static of(key: string, children: readonly Branch[] = []): Branch {
    const seen = new Set<Branch>();

    for (const child of children) {
      if (seen.has(child) || child.#adopted) {
        throw new Error("Branch must belong to exactly one parent");
      }

      seen.add(child);
    }

    for (const child of children) child.#adopted = true;

    return new Branch(key, children);
  }
}
