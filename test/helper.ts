import type { VNode } from "../src/tree";
import type { Host } from "../src/operation";
import type { DomIdentity } from "../src/dom";

export type V = VNode<DomIdentity>;

export const n = (kind: string, children: V[] = [], key?: string): V => ({
  identity: { kind, key },
  children,
});

// 木の形を文字列にする(同形判定用)
export const show = (v: V): string => {
  const label =
    v.identity.kind +
    (v.identity.key !== undefined ? "#" + v.identity.key : "");
  return v.children.length
    ? `${label}(${v.children.map(show).join(",")})`
    : label;
};

// メモリ上のホスト。DOMなしで操作を検証できる
export interface FNode {
  label: string;
  children: FNode[];
  parent: FNode | null;
}

export const showHost = (x: FNode): string =>
  x.children.length
    ? `${x.label}(${x.children.map(showHost).join(",")})`
    : x.label;

export function fakeHost() {
  const stats = { created: 0, inserts: 0, removes: 0 };
  const host: Host<FNode, DomIdentity> = {
    create(v) {
      stats.created++;
      const { kind, key } = v;
      return {
        label: kind + (key !== undefined ? "#" + key : ""),
        children: [],
        parent: null,
      };
    },
    insert(parent, node, before) {
      stats.inserts++;
      if (node.parent)
        node.parent.children.splice(node.parent.children.indexOf(node), 1);
      const at = before
        ? parent.children.indexOf(before)
        : parent.children.length;
      parent.children.splice(at, 0, node);
      node.parent = parent;
    },
    remove(node) {
      stats.removes++;
      if (node.parent)
        node.parent.children.splice(node.parent.children.indexOf(node), 1);
      node.parent = null;
    },
    key(id) {
      return `${id.kind}:${String(id.key)}`;
    },
  };
  const container: FNode = { label: "container", children: [], parent: null };
  return { host, stats, container };
}
