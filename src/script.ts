import type { Branch } from "./tree.ts";
import type { ChildrenPlan } from "./plan.ts";

export type Anchor = {
  readonly parent: Branch | null;
  readonly before: Branch | null;
};

export type StructOp =
  | { readonly kind: "create"; readonly node: Branch; readonly at: Anchor }
  | { readonly kind: "move"; readonly node: Branch; readonly to: Anchor }
  | { readonly kind: "remove"; readonly node: Branch };

export type RootChange = {
  readonly removed: Branch | null;
  readonly added: Branch | null;
};

export function scriptRoot(change: RootChange): StructOp[] {
  const ops: StructOp[] = [];

  if (change.removed) ops.push({ kind: "remove", node: change.removed });

  if (change.added) {
    ops.push({
      kind: "create",
      node: change.added,
      at: { parent: null, before: null },
    });
  }

  return ops;
}

// 契約: 1つの親に対する操作列は、先頭から順に実行されて初めて意味を持つ。
//       親が異なる操作同士は独立で、並べ替えてよい。
export function script(plans: readonly ChildrenPlan[]): StructOp[] {
  const ops: StructOp[] = [];

  for (const childrenPlan of plans) scriptChildren(childrenPlan, ops);

  return ops;
}

function scriptChildren(
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

  // 後ろから。次の兄弟が配置済みのアンカー
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

// 最長増加部分列に含まれる位置を 1 にする(全部 0 でも結果は正しい)
function stableSet(sequence: number[]): Uint8Array {
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

function pair<T, U>(a: T, b: U): [T, U] {
  return [a, b];
}
