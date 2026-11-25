import type { VNode } from "./tree.ts";
import type { Pair } from "./relation.ts";
import type { Anchor, StructOp } from "./script.ts";

export interface Host<N> {
  // この VNode に対応する実体を供給する(既存ノードを返してもよい)。
  // 参照以外(key, children)は見ない契約。メタは利用者側のテーブルで引く。
  create(v: VNode): N;
  insert(parent: N, node: N, before: N | null): void; // 既存ならmove
  remove(node: N): void;
}
export type Binding<N> = WeakMap<VNode, N>;

function mount<N>(host: Host<N>, binding: Binding<N>, v: VNode): N {
  const n = host.create(v);
  binding.set(v, n);
  for (const c of v.children) host.insert(n, mount(host, binding, c), null);
  return n;
}

export function execute<N>(
  host: Host<N>,
  binding: Binding<N>,
  container: N,
  pairs: ReadonlySet<Pair>,
  ops: readonly StructOp[],
): void {
  const h = (v: VNode) => binding.get(v)!;
  const parentOf = (a: Anchor) => (a.parent ? h(a.parent) : container);
  const beforeOf = (a: Anchor) => (a.before ? h(a.before) : null);

  const doomed = new Map<VNode, N>();
  for (const op of ops)
    if (op.kind === "remove") doomed.set(op.node, h(op.node));

  const handed = [...pairs].map((p) => [p.next, h(p.prev)] as const);
  for (const [next, handle] of handed) binding.set(next, handle);

  for (const op of ops) {
    switch (op.kind) {
      case "create": {
        const node = mount(host, binding, op.node);
        host.insert(parentOf(op.at), node, beforeOf(op.at));
        break;
      }
      case "move":
        host.insert(parentOf(op.to), h(op.node), beforeOf(op.to));
        break;
      case "remove":
        host.remove(doomed.get(op.node)!);
        break;
    }
  }
}
