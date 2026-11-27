import type { Branch } from "./tree.ts";
import { script } from "./script.ts";
import { relate } from "./relation.ts";
import { execute, type Host } from "./operation.ts";
import { rootOperations } from "./util.ts";

/**
 * Reconciles the host structure with a desired tree.
 *
 * The reconciler retains the previously submitted tree and uses it
 * as the basis for subsequent updates.
 */
export class Reconciler {
  readonly #host: Host;
  #current: Branch | null = null;

  /**
   * Creates a reconciler for the given host.
   *
   * @param host The host used to apply structural operations.
   */
  constructor(host: Host) {
    this.#host = host;
  }

  /**
   * Updates the host structure to match the desired tree.
   *
   * Corresponding branches are reused where possible, preserving
   * their associated host nodes.
   *
   * @param next The desired tree, or `null` to clear the current tree.
   */
  update(next: Branch | null): void {
    const prev = this.#current;

    if (prev && next) {
      const matching = relate(prev, next);
      const operations = script(matching, prev, next);

      execute(this.#host, matching, operations);
    } else {
      const operations = rootOperations({ prev, next });

      execute(this.#host, null, operations);
    }

    this.#current = next;
  }
}
