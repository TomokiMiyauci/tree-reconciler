import type { VNode } from "./tree";
import type { Identity, Relation } from "./relation";
import type { StructOp } from "./script";

export interface Host<N, T> extends Identity<T> {
  create(v: T): N; // identity の解釈はホストが行う
  insert(parent: N, node: N, before: N | null): void; // 既存ならmove
  remove(node: N): void;
}
export type Binding<N, T> = WeakMap<VNode<T>, N>;

function mount<N, T>(host: Host<N, T>, binding: Binding<N, T>, v: VNode<T>): N {
  const n = host.create(v.identity);
  binding.set(v, n);
  for (const c of v.children) host.insert(n, mount(host, binding, c), null);
  return n;
}

export function mountRoot<N, T>(
  host: Host<N, T>,
  binding: Binding<N, T>,
  v: VNode<T>,
  container: N,
) {
  host.insert(container, mount(host, binding, v), null);
}

export function execute<N, T>(
  host: Host<N, T>,
  binding: Binding<N, T>,
  rel: Relation<T>,
  ops: readonly StructOp<T>[],
): void {
  const h = (v: VNode<T>) => binding.get(v)!;

  // 旧側を指す remove の対象は、引き継ぎで binding が書き換わる前に解決しておく
  const doomed = new Map<VNode<T>, N>();
  for (const op of ops)
    if (op.kind === "remove") doomed.set(op.node, h(op.node));

  // 引き継ぎ: 「全部読んでから全部書く」。pairs の順序に依存させない
  const handed = [...rel.pairs].map((p) => [p.next, h(p.prev)] as const);
  for (const [next, handle] of handed) binding.set(next, handle);

  for (const op of ops) {
    switch (op.kind) {
      case "create":
        host.insert(
          h(op.at.parent),
          mount(host, binding, op.node),
          op.at.before && h(op.at.before),
        );
        break;
      case "move":
        host.insert(
          h(op.to.parent),
          h(op.node),
          op.to.before && h(op.to.before),
        );
        break;
      case "remove":
        host.remove(doomed.get(op.node)!);
        break;
    }
  }
}
