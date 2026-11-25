import type { VNode } from "./tree";
import { relate } from "./relation";
import { plan, replace } from "./plan";
import { script } from "./script";
import { execute, type Host, type Binding } from "./operation";

export interface Root {
  render(next: VNode): void;
  unmount(): void;
}

export function createRoot<N>(host: Host<N>, container: N): Root {
  const binding: Binding<N> = new WeakMap();
  let current: VNode | null = null;

  const apply = (next: VNode | null) => {
    if (current && next) {
      const relation = relate(current, next);
      const structPlan = plan(relation);
      const structOperation = script(structPlan);

      execute(host, binding, container, relation.pairs, structOperation);
    } else {
      execute(
        host,
        binding,
        container,
        new Set(),
        script(replace(current, next)),
      );
    }
    current = next;
  };

  return { render: apply, unmount: () => apply(null) };
}
