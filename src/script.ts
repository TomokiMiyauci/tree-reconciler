import type { VNode } from "./tree.ts";
import type { ChildrenPlan, StructPlan } from "./plan.ts";

// 親の中での相対位置。parent が null のときはマウント先のコンテナ直下。
// before は parent の子(parent が null ならコンテナ直下のルート)。null は末尾。
export type Anchor<T> = {
  readonly parent: VNode<T> | null;
  readonly before: VNode<T> | null;
};

// 参照するノードの側: remove は旧側。create / move / Anchor は新側
export type StructOp<T> =
  | { readonly kind: "create"; readonly node: VNode<T>; readonly at: Anchor<T> }
  | { readonly kind: "move"; readonly node: VNode<T>; readonly to: Anchor<T> }
  | { readonly kind: "remove"; readonly node: VNode<T> };

// 契約: 1つの親に対する操作列は、先頭から順に実行されて初めて意味を持つ。
//       親が異なる操作同士は独立で、並べ替えてよい。
export function script<T>(sp: StructPlan<T>): StructOp<T>[] {
  const ops: StructOp<T>[] = [];

  if (sp.kind === "replace") {
    // 先に消してから作る。どちらも null でありうる(初回・unmount)
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

function scriptChildren<T>(
  { parent, slots, dropped }: ChildrenPlan<T>,
  ops: StructOp<T>[],
): void {
  for (const node of dropped) ops.push({ kind: "remove", node });

  const index = new Map<VNode<T>, number>();
  parent.prev.children.forEach((c, i) => index.set(c, i));
  const stable = stableSet(
    slots.map((s) => (s.tag === "kept" ? index.get(s.prev)! : -1)),
  );

  // 後ろから。次の兄弟が配置済みのアンカー
  for (let i = slots.length - 1; i >= 0; i--) {
    const s = slots[i];
    const at: Anchor<T> = {
      parent: parent.next,
      before: slots[i + 1]?.next ?? null,
    };
    if (s.tag === "fresh") ops.push({ kind: "create", node: s.next, at });
    else if (!stable[i]) ops.push({ kind: "move", node: s.next, to: at });
  }
}

// 最長増加部分列に含まれる位置を1にする(差し替え可能。全部0でも結果は正しい)
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
