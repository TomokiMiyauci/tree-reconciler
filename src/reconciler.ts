import type { Branch } from "./tree.ts";
import { script } from "./script.ts";
import { relate } from "./relation.ts";
import { execute, type Host } from "./operation.ts";
import { rootOperations } from "./util.ts";

export class Reconciler {
  #host: Host;
  #current: Branch | null = null;

  constructor(host: Host) {
    this.#host = host;
  }

  update(next: Branch | null): void {
    if (this.#current && next) {
      const matching = relate(this.#current, next);
      const operations = script(matching, this.#current, next);

      execute(this.#host, matching, operations);
    } else {
      const operations = rootOperations({ prev: this.#current, next });

      execute(this.#host, null, operations);
    }

    this.#current = next;
  }
}
