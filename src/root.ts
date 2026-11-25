import type { VNode } from "./tree.ts";
import { relate, assignByKey, type Assign } from "./relation.ts";
import { plan, replace } from "./plan.ts";
import { script } from "./script.ts";
import { execute, type Host, type Binding } from "./operation.ts";

export interface Root<T> {
  render(next: VNode<T>): void;
  unmount(): void;
}

export function createRoot<N, T>(
  host: Host<N, T>,
  container: N,
  assign: Assign = assignByKey,
): Root<T> {
  const binding: Binding<N, T> = new WeakMap();
  let current: VNode<T> | null = null;

  const apply = (next: VNode<T> | null) => {
    if (current && next) {
      const relation = relate(current, next, host, assign);
      const structPlan = plan(relation);
      const operation = script(structPlan);

      execute(host, binding, container, relation.pairs, operation);
    } else {
      const operation = script(replace(current, next));

      execute(host, binding, container, new Set(), operation);
    }
    current = next;
  };

  return {
    render: (next) => apply(next),
    unmount: () => apply(null),
  };
}
