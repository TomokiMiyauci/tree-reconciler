import { Branch } from "../src/tree.ts";
import type { Host } from "../src/operation.ts";
import type { Anchor } from "../src/script.ts";

export type V = Branch;

export const metas = new WeakMap<Branch, { kind: string; userKey?: string }>();

export const n = (kind: string, children: V[] = [], key?: string): V => {
  const vnode = Branch.of(JSON.stringify([kind, key ?? null]), children);
  metas.set(vnode, { kind, userKey: key });
  return vnode;
};

export const label = (vnode: V): string => {
  const meta = metas.get(vnode)!;
  return meta.kind + (meta.userKey !== undefined ? "#" + meta.userKey : "");
};

export const show = (vnode: V): string =>
  vnode.children.length
    ? `${label(vnode)}(${vnode.children.map(show).join(",")})`
    : label(vnode);

export interface FNode {
  label: string;
  children: FNode[];
  parent: FNode | null;
}

export const showHost = (node: FNode): string =>
  node.children.length
    ? `${node.label}(${node.children.map(showHost).join(",")})`
    : node.label;

export interface FakeHostObserver {
  created?(vnode: V, node: FNode): void;
  matched?(prev: V, next: V, node: FNode): void;
  removed?(vnode: V, node: FNode): void;
}

export function fakeHost(observer: FakeHostObserver = {}) {
  const stats = { created: 0 };
  const bindings = new WeakMap<V, FNode>();
  const container: FNode = { label: "container", children: [], parent: null };

  const resolve = (vnode: V): FNode => {
    const node = bindings.get(vnode);
    if (!node) throw new Error("not bound: " + label(vnode));
    return node;
  };
  const detach = (node: FNode) => {
    if (node.parent) {
      node.parent.children.splice(node.parent.children.indexOf(node), 1);
    }
    node.parent = null;
  };
  const insert = (node: FNode, at: Anchor) => {
    const parent = at.parent ? resolve(at.parent) : container;
    const before = at.before ? resolve(at.before) : null;
    detach(node);
    const index = before
      ? parent.children.indexOf(before)
      : parent.children.length;
    parent.children.splice(index, 0, node);
    node.parent = parent;
  };
  const mount = (vnode: V): FNode => {
    stats.created++;
    const node: FNode = { label: label(vnode), children: [], parent: null };
    bindings.set(vnode, node);
    observer.created?.(vnode, node);
    for (const child of vnode.children) {
      const childNode = mount(child);
      childNode.parent = node;
      node.children.push(childNode);
    }
    return node;
  };
  const notifyRemoved = (vnode: V) => {
    observer.removed?.(vnode, resolve(vnode));
    for (const child of vnode.children) notifyRemoved(child);
  };

  const host: Host = {
    adopt(prev, next) {
      const node = resolve(prev);
      bindings.set(next, node);
      if (next !== prev) observer.matched?.(prev, next, node);
    },
    create: (vnode, at) => insert(mount(vnode), at),
    move: (vnode, to) => insert(resolve(vnode), to),
    remove(vnode) {
      const node = resolve(vnode);
      notifyRemoved(vnode);
      detach(node);
    },
  };

  return { host, stats, container, bindings };
}

// 通知の記録用
export function recorder() {
  const events: string[] = [];
  const observer: FakeHostObserver = {
    created: (vnode) => events.push(`created ${label(vnode)}`),
    matched: (prev, next) =>
      events.push(`matched ${label(prev)}>${label(next)}`),
    removed: (vnode) => events.push(`removed ${label(vnode)}`),
  };
  return { events, observer };
}
