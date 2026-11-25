import type { VNode } from "./tree.ts";
import type { Counterparts } from "./relation.ts";
import type { Anchor, StructOp } from "./script.ts";

export interface Host<N> {
  // この VNode に対応する実体を供給する(既存ノードを返してもよい)。
  // 参照以外(key, children)は見ない契約。メタは利用者側のテーブルで引く。
  create(vnode: VNode): N;
  insert(parent: N, node: N, before: N | null): void; // 既存なら move
  remove(node: N): void;
}

export type Binding<N> = WeakMap<VNode, N>;

export interface Observer<N> {
  created?(vnode: VNode, hostNode: N): void; // 新規ノード。親へ挿入する前
  matched?(prev: VNode, next: VNode, hostNode: N): void; // 旧と新が対になった
  removed?(vnode: VNode, hostNode: N): void; // 取り除く。ホストから外す前
}

function mount<N>(
  host: Host<N>,
  binding: Binding<N>,
  observer: Observer<N>,
  vnode: VNode,
): N {
  const hostNode = host.create(vnode);
  binding.set(vnode, hostNode);
  observer.created?.(vnode, hostNode);

  for (const child of vnode.children) {
    host.insert(hostNode, mount(host, binding, observer, child), null);
  }

  return hostNode;
}

function collect<N>(
  binding: Binding<N>,
  vnode: VNode,
  into: [VNode, N][],
): void {
  into.push([vnode, binding.get(vnode)!]);
  for (const child of vnode.children) collect(binding, child, into);
}

// matching が null のときは引き継ぎなし(初回・unmount・ルート置換)
export function execute<N>(
  host: Host<N>,
  binding: Binding<N>,
  container: N,
  counterparts: Counterparts | null,
  ops: readonly StructOp[],
  observer: Observer<N>,
): void {
  const resolve = (vnode: VNode) => binding.get(vnode)!;
  const parentOf = (anchor: Anchor) =>
    anchor.parent ? resolve(anchor.parent) : container;
  const beforeOf = (anchor: Anchor) =>
    anchor.before ? resolve(anchor.before) : null;

  // 旧側を指す remove の対象は、引き継ぎで binding が書き換わる前に解決する
  const doomed = new Map<VNode, [VNode, N][]>();
  for (const op of ops) {
    if (op.kind === "remove") {
      const entries: [VNode, N][] = [];
      collect(binding, op.node, entries);
      doomed.set(op.node, entries);
    }
  }

  // 引き継ぎ: 全部読んでから全部書く(列挙順に依存させない)
  if (counterparts) {
    const handed = [...counterparts].map(
      ([next, prev]) => [next, prev, resolve(prev)] as const,
    );
    for (const [next, , hostNode] of handed) binding.set(next, hostNode);
    for (const [next, prev, hostNode] of handed) {
      if (next !== prev) observer.matched?.(prev, next, hostNode);
    }
  }

  for (const op of ops) {
    switch (op.kind) {
      case "create": {
        const hostNode = mount(host, binding, observer, op.node);
        host.insert(parentOf(op.at), hostNode, beforeOf(op.at));
        break;
      }
      case "move":
        host.insert(parentOf(op.to), resolve(op.node), beforeOf(op.to));
        break;
      case "remove": {
        const entries = doomed.get(op.node)!;
        for (const [vnode, hostNode] of entries)
          observer.removed?.(vnode, hostNode);
        host.remove(entries[0][1]);
        break;
      }
    }
  }
}
