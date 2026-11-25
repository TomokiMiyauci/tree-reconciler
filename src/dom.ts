import type { Host } from "./operation.ts";
import { VNode } from "./tree.ts";

export interface DomMeta {
  kind: string;
}

export class DOMHost implements Host<Node> {
  private doc: Document;
  private map: WeakMap<VNode, DomMeta>;

  constructor(doc: Document, map: WeakMap<VNode, DomMeta>) {
    this.doc = doc;
    this.map = map;
  }

  create(v: VNode) {
    const meta = this.map.get(v);
    if (!meta)
      throw new Error(
        "VNode has no DomMeta: create it with the same map given to DOMHost",
      );

    return meta.kind === "#text"
      ? this.doc.createTextNode("")
      : this.doc.createElement(meta.kind);
  }

  insert(parent: Node, node: Node, before: Node | null) {
    parent.insertBefore(node, before);
  }

  remove(node: Node) {
    node.parentNode?.removeChild(node);
  }
}
