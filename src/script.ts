import type { VNode } from "./tree.ts";
import type { ChildrenPlan, StructPlan } from "./plan.ts";

export type Anchor = {
  readonly parent: VNode | null; // null はコンテナ直下
  readonly before: VNode | null;
};

export type StructOp =
  | { readonly kind: "create"; readonly node: VNode; readonly at: Anchor }
  | { readonly kind: "move"; readonly node: VNode; readonly to: Anchor }
  | { readonly kind: "remove"; readonly node: VNode };

export function script(sp: StructPlan): StructOp[] {
  const ops: StructOp[] = [];

  if (sp.kind === "replace") {
    if (sp.dropped) ops.push({ kind: "remove", node: sp.dropped });
    if (sp.fresh)
      ops.push({
        kind: "create",
        node: sp.fresh,
        at: { parent: null, before: null },
      });
    return ops;
  }

  for (const children of sp.children) scriptChildren(children, ops);
  return ops;
}

function scriptChildren(
  { parent, slots, dropped }: ChildrenPlan,
  ops: StructOp[],
): void {
  for (const node of dropped) ops.push({ kind: "remove", node });

  const index = new Map<VNode, number>();
  parent.prev.children.forEach((c, i) => index.set(c, i));
  const stable = stableSet(
    slots.map((s) => (s.tag === "kept" ? index.get(s.prev)! : -1)),
  );

  for (let i = slots.length - 1; i >= 0; i--) {
    const s = slots[i];
    const at: Anchor = {
      parent: parent.next,
      before: slots[i + 1]?.next ?? null,
    };
    if (s.tag === "fresh") ops.push({ kind: "create", node: s.next, at });
    else if (!stable[i]) ops.push({ kind: "move", node: s.next, to: at });
  }
}

function stableSet(seq: number[]): Uint8Array {
  const tails: number[] = [];
  const back = new Int32Array(seq.length).fill(-1);
  for (let i = 0; i < seq.length; i++) {
    if (seq[i] < 0) continue;
    let lo = 0,
      hi = tails.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (seq[tails[m]] < seq[i]) lo = m + 1;
      else hi = m;
    }
    if (lo > 0) back[i] = tails[lo - 1];
    tails[lo] = i;
  }
  const mark = new Uint8Array(seq.length);
  for (let k = tails.length ? tails[tails.length - 1] : -1; k >= 0; k = back[k])
    mark[k] = 1;
  return mark;
}
