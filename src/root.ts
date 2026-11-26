import type { Branch } from "./tree.ts";
import { relate } from "./relation.ts";
import { script } from "./script.ts";
import { execute, type Host } from "./operation.ts";
import { rootOperations } from "./util.ts";

export interface Root {
  render(next: Branch): void;
  unmount(): void;
}

export function createRoot(host: Host): Root {
  let current: Branch | null = null;

  const apply = (next: Branch | null) => {
    if (current && next) {
      const matching = relate(current, next);
      const operations = script(matching, current, next);

      execute(host, matching, operations);
    } else if (current || next) {
      const operations = rootOperations({ prev: current, next });

      execute(host, null, operations);
    }

    current = next;
  };

  return { render: apply, unmount: () => apply(null) };
}
