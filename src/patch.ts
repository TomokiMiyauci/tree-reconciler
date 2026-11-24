import { relate, assignByKey, Assign } from "./relation.ts";
import type { VNode } from "./tree.ts";
import { script } from "./script.ts";
import { plan } from "./plan.ts";
import { execute, type Host, type Binding } from "./operation.ts";

export function patch<N, T>(
  host: Host<N, T>,
  binding: Binding<N, T>,
  prev: VNode<T>,
  next: VNode<T>,
  assign: Assign = assignByKey,
): void {
  const rel = relate(prev, next, host, assign); // Host が Identity を継承している前提
  execute(host, binding, rel, script(plan(rel)));
}
