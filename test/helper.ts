import type { VNode } from "../src/tree";
import type { Host } from "../src/operation";
import type { DomMeta } from "../src/dom";
import type { Observer } from "../src/operation.ts";

export type V = VNode;

// ---- VNode 作成(メタは WeakMap に持つ。DOMHost と同じ構造) ----
export interface TestMeta extends DomMeta {
  userKey?: string; // 表示用。同一性は VNode.key が担う
}

export const metas = new WeakMap<VNode, TestMeta>();

export const n = (kind: string, children: V[] = [], key?: string): V => {
  const v: V = { key: JSON.stringify([kind, key ?? null]), children };
  metas.set(v, { kind, userKey: key });
  return v;
};

export const label = (v: V): string => {
  const m = metas.get(v)!;
  return m.kind + (m.userKey !== undefined ? "#" + m.userKey : "");
};

// 木の形を文字列にする(同形判定用)
export const show = (v: V): string =>
  v.children.length
    ? `${label(v)}(${v.children.map(show).join(",")})`
    : label(v);

// ---- メモリ上のホスト。DOMなしで操作を検証できる ----
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
  const host: Host<FNode> = {
    create(v) {
      stats.created++;
      return { label: label(v), children: [], parent: null };
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
  };
  const container: FNode = { label: "container", children: [], parent: null };
  return { host, stats, container };
}

export function recorder() {
  const events: string[] = [];
  const observer: Observer<FNode> = {
    created: (vnode) => events.push(`created ${label(vnode)}`),
    matched: (prev, next) =>
      events.push(`matched ${label(prev)}>${label(next)}`),
    removed: (vnode) => events.push(`removed ${label(vnode)}`),
  };
  return { events, observer };
}
