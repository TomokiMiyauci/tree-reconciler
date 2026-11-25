import type { VNode } from "./tree.ts";
import { relate } from "./relation.ts";
import { plan } from "./plan.ts";
import { script, scriptRoot } from "./script.ts";
import { execute, type Host, type Binding } from "./operation.ts";

export interface Root {
  render(next: VNode): void;
  unmount(): void;
}

export function createRoot<N>(host: Host<N>, container: N): Root {
  const binding: Binding<N> = new WeakMap();
  let current: VNode | null = null;

  const apply = (next: VNode | null) => {
    if (current && next) {
      const matching = relate(current, next);

      if (matching) {
        execute(host, binding, container, matching, script(plan(matching)), {});
      } else {
        // ルートが対にならない: 旧を外して新を作る
        execute(
          host,
          binding,
          container,
          null,
          scriptRoot({ removed: current, added: next }),
          {},
        );
      }
    } else if (current || next) {
      // 初回(removed なし)または unmount(added なし)
      execute(
        host,
        binding,
        container,
        null,
        scriptRoot({ removed: current, added: next }),
        {},
      );
    }
    current = next; // execute が成功した後にだけ更新する
  };

  return { render: apply, unmount: () => apply(null) };
}
