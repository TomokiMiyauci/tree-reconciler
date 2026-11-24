import type { VNode } from "./tree";
import { relate, assignByKey, type Assign, type Identity } from "./relation";
import { plan } from "./plan";
import { script } from "./script";
import { execute, mountRoot, type Host, type Binding } from "./operation";

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

  return {
    render(next) {
      if (current === null) {
        mountRoot(host, binding, next, container);
      } else if (host.key(current.identity) !== host.key(next.identity)) {
        host.remove(binding.get(current)!);
        mountRoot(host, binding, next, container);
      } else {
        const rel = relate(current, next, host, assign);
        execute(host, binding, rel, script(plan(rel)));
      }
      current = next;
    },
    unmount() {
      if (current) host.remove(binding.get(current)!);
      current = null;
    },
  };
}
