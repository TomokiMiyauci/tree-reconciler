import type { Branch } from "./tree.ts";
import type { Counterparts } from "./relation.ts";
import type { Anchor, StructOp } from "./script.ts";

export interface Host {
  adopt(prev: Branch, next: Branch): void;
  create(vnode: Branch, at: Anchor): void;
  move(vnode: Branch, to: Anchor): void;
  remove(vnode: Branch): void;
}

export function execute(
  host: Host,
  counterparts: Counterparts | null,
  ops: readonly StructOp[],
): void {
  if (counterparts) {
    for (const [next, prev] of counterparts) host.adopt(prev, next);
  }

  for (const op of ops) {
    switch (op.kind) {
      case "create":
        host.create(op.node, op.at);
        break;
      case "move":
        host.move(op.node, op.to);
        break;
      case "remove":
        host.remove(op.node);
        break;
    }
  }
}
