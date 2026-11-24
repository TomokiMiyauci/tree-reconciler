import type { Host } from "./operation.ts";
import type { Identity } from "./relation.ts";

export interface DomIdentity {
  kind: string;
  key?: string | number;
}

export const domIdentity: Identity<DomIdentity> = {
  key: (a) => `${a.kind}:${String(a.key)}`,
};

export class DOMHost implements Host<Node, DomIdentity> {
  private doc: Document;
  constructor(doc: Document) {
    this.doc = doc;
  }

  key(a: DomIdentity) {
    return `${a.kind}:${String(a.key)}`;
  }

  create(v: DomIdentity) {
    return v.kind === "#text"
      ? this.doc.createTextNode("")
      : this.doc.createElement(v.kind);
  }

  insert(parent: Node, node: Node, before: Node | null) {
    parent.insertBefore(node, before);
  }

  remove(node: Node) {
    node.parentNode?.removeChild(node);
  }
}
