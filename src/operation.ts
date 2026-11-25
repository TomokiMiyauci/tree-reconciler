import type { VNode } from "./tree.ts";
import type { Identity, Pair } from "./relation.ts";
import type { Anchor, StructOp } from "./script.ts";

export interface Host<N, T> extends Identity<T> {
  create(identity: T): N;
  insert(parent: N, node: N, before: N | null): void;
  remove(node: N): void;
}
export type Binding<N, T> = WeakMap<VNode<T>, N>;

export function mount<N, T>(
  host: Host<N, T>,
  binding: Binding<N, T>,
  v: VNode<T>,
): N {
  const n = host.create(v.identity);

  binding.set(v, n);

  for (const c of v.children) host.insert(n, mount(host, binding, c), null);

  return n;
}

export function execute<N, T>(
  host: Host<N, T>,
  binding: Binding<N, T>,
  container: N,
  pairs: ReadonlySet<Pair<T>>,
  ops: readonly StructOp<T>[],
): void {
  const h = (v: VNode<T>) => binding.get(v)!;
  const parentOf = (a: Anchor<T>) => (a.parent ? h(a.parent) : container);
  const beforeOf = (a: Anchor<T>) => (a.before ? h(a.before) : null);

  // 旧側を指す remove の対象は、引き継ぎで binding が書き換わる前に解決しておく
  const doomed = new Map<VNode<T>, N>();

  for (const op of ops)
    if (op.kind === "remove") doomed.set(op.node, h(op.node));

  // 引き継ぎ: 「全部読んでから全部書く」。pairs の順序に依存させない
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
