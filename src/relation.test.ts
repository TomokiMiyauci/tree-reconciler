import { describe, it, expect } from "bun:test";
import { relate, type Counterparts } from "./relation.ts";
import { Branch } from "./tree.ts";

const names = new WeakMap<Branch, string>();

interface NodeChildren {
  [label: string]: NodeChildren;
}

// "A1#item": ラベルが A1、key が item。"#" がなければ key はラベル
function node(spec: string, children: NodeChildren = {}): Branch {
  const [name, key] = spec.split("#", 2);
  const vnode: Branch = Branch.of(
    key || name,
    Object.entries(children).map(([childSpec, grandChildren]) =>
      node(childSpec, grandChildren),
    ),
  );
  names.set(vnode, name);
  return vnode;
}

function pairsOf(counterparts: Counterparts): [string, string][] {
  return [...counterparts]
    .map(
      ([next, prev]) =>
        [names.get(prev)!, names.get(next)!] as [string, string],
    )
    .sort(
      ([prevA, nextA], [prevB, nextB]) =>
        prevA.localeCompare(prevB) || nextA.localeCompare(nextB),
    );
}

const cases = [
  {
    name: "matches the root",
    prev: node("A#root"),
    next: node("B#root"),
    pairs: [["A", "B"]],
  },
  {
    name: "matches children regardless of their order",
    prev: node("A#root", { "A1#first": {}, "A2#second": {} }),
    next: node("B#root", { "B1#second": {}, "B2#first": {} }),
    pairs: [
      ["A", "B"],
      ["A1", "B2"],
      ["A2", "B1"],
    ],
  },
  {
    name: "matches nested children",
    prev: node("A#root", { "A1#parent": { "A2#child": {} } }),
    next: node("B#root", { "B1#parent": { "B2#child": {} } }),
    pairs: [
      ["A", "B"],
      ["A1", "B1"],
      ["A2", "B2"],
    ],
  },
  {
    name: "does not match children with different keys",
    prev: node("A#root", { "A1#old": {} }),
    next: node("B#root", { "B1#new": {} }),
    pairs: [["A", "B"]],
  },
  {
    name: "does not match a child whose parent is unmatched",
    prev: node("A#root", { "A1#p": { "A2#child": {} } }),
    next: node("B#root", { "B1#q": { "B2#child": {} } }),
    pairs: [["A", "B"]],
  },
  {
    name: "does not move a child to a different parent",
    prev: node("A#root", { "A1#p": { "A2#child": {} }, "A3#q": {} }),
    next: node("B#root", { "B1#p": {}, "B2#q": { "B3#child": {} } }),
    pairs: [
      ["A", "B"],
      ["A1", "B1"],
      ["A3", "B2"],
    ],
  },
  {
    name: "pairs same-key siblings in order of appearance",
    prev: node("A#root", { "A1#item": {}, "A2#item": {}, "A3#item": {} }),
    next: node("B#root", { "B1#item": {}, "B2#item": {} }),
    pairs: [
      ["A", "B"],
      ["A1", "B1"],
      ["A2", "B2"],
    ],
  },
  {
    name: "leaves extra same-key siblings in next unmatched",
    prev: node("A#root", { "A1#item": {}, "A2#item": {} }),
    next: node("B#root", { "B1#item": {}, "B2#item": {}, "B3#item": {} }),
    pairs: [
      ["A", "B"],
      ["A1", "B1"],
      ["A2", "B2"],
    ],
  },
  {
    name: "pairs same-key siblings in order even when mixed with other keys",
    prev: node("A#root", { "A1#x": {}, "A2#y": {}, "A3#x": {} }),
    next: node("B#root", { "B1#y": {}, "B2#x": {}, "B3#x": {} }),
    pairs: [
      ["A", "B"],
      ["A1", "B2"],
      ["A2", "B1"],
      ["A3", "B3"],
    ],
  },
  {
    name: "stops descending at the first unmatched ancestor",
    prev: node("A#r", { "A1#a": { "A2#b": { "A3#c": {} } } }),
    next: node("B#r", { "B1#a": { "B2#x": { "B3#c": {} } } }),
    pairs: [
      ["A", "B"],
      ["A1", "B1"],
    ],
  },
];

describe("relate", () => {
  for (const testCase of cases) {
    it(testCase.name, () => {
      const counterparts = relate(testCase.prev, testCase.next);
      expect(counterparts).not.toBeNull();
      expect(pairsOf(counterparts!)).toEqual(
        testCase.pairs as [string, string][],
      );
    });
  }

  it("returns null when the root keys differ", () => {
    expect(relate(node("A#one"), node("B#two"))).toBeNull();
  });

  it("does not mix up a node shared by prev and next", () => {
    const shared = node("S#s");
    const prev = node("A#root");
    const next = node("B#root");
    (prev.children as Branch[]).push(shared);
    (next.children as Branch[]).push(shared);

    const counterparts = relate(prev, next)!;
    expect(counterparts.get(shared)).toBe(shared);
    expect(counterparts.size).toBe(2);
  });
});
