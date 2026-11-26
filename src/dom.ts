import type { Branch } from "./tree.ts";
import type { Host } from "./operation.ts";
import type { Anchor } from "./script.ts";

export interface DomMeta {
  kind: string;
}

export class DOMHost implements Host {
  readonly #bindings = new WeakMap<Branch, Node>();
  readonly #document: Document;
  readonly #container: Node;
  readonly #metas: WeakMap<Branch, DomMeta>;

  constructor(
    document: Document,
    container: Node,
    metas: WeakMap<Branch, DomMeta>,
  ) {
    this.#document = document;
    this.#container = container;
    this.#metas = metas;
  }

  adopt(prev: Branch, next: Branch): void {
    const node = this.#resolve(prev);

    this.#bindings.set(next, node);
  }

  create(vnode: Branch, at: Anchor): void {
    this.#insert(this.#mount(vnode), at);
  }

  move(vnode: Branch, to: Anchor): void {
    const node = this.#resolve(vnode);

    this.#insert(node, to);
  }

  remove(vnode: Branch): void {
    const node = this.#resolve(vnode);

    node.parentNode?.removeChild(node);
  }

  #resolve(vnode: Branch): Node {
    const node = this.#bindings.get(vnode);

    if (!node) throw new Error("Branch is not bound to a DOM node");

    return node;
  }

  #insert(node: Node, at: Anchor): void {
    const parent = at.parent ? this.#resolve(at.parent) : this.#container;
    const before = at.before && this.#resolve(at.before);

    parent.insertBefore(node, before);
  }

  #mount(vnode: Branch): Node {
    const meta = this.#metas.get(vnode);

    if (!meta) {
      throw new Error(
        "Branch has no DomMeta: register it in the map given to DOMHost",
      );
    }

    const node =
      meta.kind === "#text"
        ? this.#document.createTextNode("")
        : this.#document.createElement(meta.kind);

    this.#bindings.set(vnode, node);

    for (const child of vnode.children) node.appendChild(this.#mount(child));

    return node;
  }
}
