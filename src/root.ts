import type { Branch } from "./tree.ts";
import { relate } from "./relation.ts";
import { script } from "./script.ts";
import { execute, type Host, type Binding } from "./operation.ts";
import { rootOperations } from "./util.ts";

export interface Root {
  render(next: Branch): void;
  unmount(): void;
}

export function createRoot<N>(host: Host<N>, container: N): Root {
  const binding: Binding<N> = new WeakMap();
  let current: Branch | null = null;

  const apply = (next: Branch | null) => {
    if (current && next) {
      const matching = relate(current, next);
      const operations = script(matching, current, next);

      execute(host, binding, container, matching, operations, {});
    } else if (current || next) {
      // 初回(removed なし)または unmount(added なし)
      const operations = rootOperations({ prev: current, next });

      execute(host, binding, container, null, operations, {});
    }

    current = next; // execute が成功した後にだけ更新する
  };

  return { render: apply, unmount: () => apply(null) };
}
