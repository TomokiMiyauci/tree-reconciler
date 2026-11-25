import { describe, it, expect } from "bun:test";

import { relate, type Relation } from "./relation.ts";
import { VNode } from "./tree.ts";

const names = new WeakMap<VNode, string>();

const cases = [
  {
    name: "matches the root",
    prev: node("A#root", {}),
    next: node("B#root", {}),
    pairs: [["A", "B"]],
  },
  {
    name: "does not match the root",
    prev: node("A#root", {}),
    next: node("B#root2", {}),
    pairs: [],
  },
  {
    name: "does not descend when roots have different keys",
    prev: node("A#root", {
      "A1#item": {
        "A2#child": {},
      },
    }),
    next: node("B#other", {
      "B1#item": {
        "B2#child": {},
      },
    }),
    pairs: [],
  },
  {
    name: "matches children with the same key",
    prev: node("A#root", {
      "A1#item": {},
    }),
    next: node("B#root", {
      "B1#item": {},
    }),
    pairs: [
      ["A", "B"],
      ["A1", "B1"],
    ],
  },
  {
    name: "does not match children with different keys",
    prev: node("A#root", {
      "A1#old": {},
    }),
    next: node("B#root", {
      "B1#new": {},
    }),
    pairs: [["A", "B"]],
  },
  {
    name: "matches when a child is added",
    prev: node("A#root", {}),
    next: node("B#root", {
      "B1#item": {},
    }),
    pairs: [["A", "B"]],
  },
  {
    name: "matches when a child is removed",
    prev: node("A#root", {
      "A1#item": {},
    }),
    next: node("B#root", {}),
    pairs: [["A", "B"]],
  },
  {
    name: "matches children regardless of their order",
    prev: node("A#root", {
      "A1#first": {},
      "A2#second": {},
    }),
    next: node("B#root", {
      "B1#second": {},
      "B2#first": {},
    }),
    pairs: [
      ["A", "B"],
      ["A1", "B2"],
      ["A2", "B1"],
    ],
  },
  {
    name: "matches nested children",
    prev: node("A#root", {
      "A1#parent": {
        "A2#child": {},
      },
    }),
    next: node("B#root", {
      "B1#parent": {
        "B2#child": {},
      },
    }),
    pairs: [
      ["A", "B"],
      ["A1", "B1"],
      ["A2", "B2"],
    ],
  },
  {
    name: "matches nested children regardless of their order",
    prev: node("A#root", {
      "A1#parent": {
        "A2#first": {},
        "A3#second": {},
      },
    }),
    next: node("B#root", {
      "B1#parent": {
        "B2#second": {},
        "B3#first": {},
      },
    }),
    pairs: [
      ["A", "B"],
      ["A1", "B1"],
      ["A2", "B3"],
      ["A3", "B2"],
    ],
  },
  {
    name: "matches nested children when a child is added",
    prev: node("A#root", {
      "A1#parent": {
        "A2#first": {},
      },
    }),
    next: node("B#root", {
      "B1#parent": {
        "B2#first": {},
        "B3#second": {},
      },
    }),
    pairs: [
      ["A", "B"],
      ["A1", "B1"],
      ["A2", "B2"],
    ],
  },
  {
    name: "matches nested children when a child is removed",
    prev: node("A#root", {
      "A1#parent": {
        "A2#first": {},
        "A3#second": {},
      },
    }),
    next: node("B#root", {
      "B1#parent": {
        "B2#first": {},
      },
    }),
    pairs: [
      ["A", "B"],
      ["A1", "B1"],
      ["A2", "B2"],
    ],
  },
  {
    name: "matches parents regardless of their order",
    prev: node("A#root", {
      "A1#first": {
        "A2#child": {},
      },
      "A3#second": {},
    }),
    next: node("B#root", {
      "B1#second": {},
      "B2#first": {
        "B3#child": {},
      },
    }),
    pairs: [
      ["A", "B"],
      ["A1", "B2"],
      ["A2", "B3"],
      ["A3", "B1"],
    ],
  },
  {
    name: "pairs same-key siblings in occurrence order",
    prev: node("A#root", {
      "A1#item": {},
      "A2#item": {},
      "A3#item": {},
    }),
    next: node("B#root", {
      "B1#item": {},
      "B2#item": {},
    }),
    pairs: [
      ["A", "B"],
      ["A1", "B1"],
      ["A2", "B2"],
    ],
  },
  {
    name: "leaves excess next siblings unmatched",
    prev: node("A#root", {
      "A1#item": {},
      "A2#item": {},
    }),
    next: node("B#root", {
      "B1#item": {},
      "B2#item": {},
      "B3#item": {},
    }),
    pairs: [
      ["A", "B"],
      ["A1", "B1"],
      ["A2", "B2"],
    ],
  },
  {
    name: "pairs same-key siblings in occurrence order regardless of surrounding nodes",
    prev: node("A#root", {
      "A1#x": {},
      "A2#y": {},
      "A3#x": {},
    }),
    next: node("B#root", {
      "B1#y": {},
      "B2#x": {},
      "B3#x": {},
    }),
    pairs: [
      ["A", "B"],
      ["A1", "B2"],
      ["A2", "B1"],
      ["A3", "B3"],
    ],
  },
  {
    name: "does not match children whose parents are unmatched",
    prev: node("A#root", {
      "A1#p": {
        "A2#child": {},
      },
    }),
    next: node("B#root", {
      "B1#q": {
        "B2#child": {},
      },
    }),
    pairs: [["A", "B"]],
  },
  {
    name: "does not match a child moved to a different parent",
    prev: node("A#root", {
      "A1#p": {
        "A2#child": {},
      },
      "A3#q": {},
    }),
    next: node("B#root", {
      "B1#p": {},
      "B2#q": {
        "B3#child": {},
      },
    }),
    pairs: [
      ["A", "B"],
      ["A1", "B1"],
      ["A3", "B2"],
    ],
  },
  {
    name: "uses keys rather than names to determine equivalence",
    prev: node("A#root", {
      "X#one": {},
    }),
    next: node("B#root", {
      "X#two": {},
    }),
    pairs: [["A", "B"]],
  },
  {
    name: "matches nodes with different names but the same key",
    prev: node("A#root", {
      "P#same": {},
    }),
    next: node("B#root", {
      "Q#same": {},
    }),
    pairs: [
      ["A", "B"],
      ["P", "Q"],
    ],
  },
  {
    name: "matches keyless siblings using their names as keys",
    prev: node("A#root", {
      span: {},
      div: {},
    }),
    next: node("B#root", {
      div: {},
      span: {},
    }),
    pairs: [
      ["A", "B"],
      ["div", "div"],
      ["span", "span"],
    ],
  },
  {
    name: "matches explicit keys independently of node names",
    prev: node("A#root", {
      "span#div": {},
      div: {},
    }),
    next: node("B#root", {
      "div#div": {},
      span: {},
    }),
    pairs: [
      ["A", "B"],
      ["span", "div"],
    ],
  },
  {
    name: "matches a deeply nested identical tree",
    prev: node("A#r", {
      "A1#a": {
        "A2#b": {
          "A3#c": {},
        },
      },
    }),
    next: node("B#r", {
      "B1#a": {
        "B2#b": {
          "B3#c": {},
        },
      },
    }),
    pairs: [
      ["A", "B"],
      ["A1", "B1"],
      ["A2", "B2"],
      ["A3", "B3"],
    ],
  },
  {
    name: "stops descending at the first unmatched ancestor",
    prev: node("A#r", {
      "A1#a": {
        "A2#b": {
          "A3#c": {},
        },
      },
    }),
    next: node("B#r", {
      "B1#a": {
        "B2#x": {
          "B3#c": {},
        },
      },
    }),
    pairs: [
      ["A", "B"],
      ["A1", "B1"],
    ],
  },
  {
    name: "matches duplicate keys in occurrence order",
    prev: node("A#r", {
      "A1#a": {},
      "A2#a": {},
    }),
    next: node("B#r", {
      "B1#a": {},
      "B2#a": {},
    }),
    pairs: [
      ["A", "B"],
      ["A1", "B1"],
      ["A2", "B2"],
    ],
  },
  {
    name: "matches only the available duplicate",
    prev: node("A#r", {
      "A1#a": {},
    }),
    next: node("B#r", {
      "B1#a": {},
      "B2#a": {},
    }),
    pairs: [
      ["A", "B"],
      ["A1", "B1"],
    ],
  },
  {
    name: "matches the first available duplicate",
    prev: node("A#r", {
      "A1#a": {},
      "A2#a": {},
    }),
    next: node("B#r", {
      "B1#a": {},
    }),
    pairs: [
      ["A", "B"],
      ["A1", "B1"],
    ],
  },
  {
    name: "matches duplicate keys in occurrence order regardless of surrounding nodes",
    prev: node("A#r", {
      "A1#a": {},
      "A2#b": {},
      "A3#a": {},
    }),
    next: node("B#r", {
      "B1#a": {},
      "B2#a": {},
      "B3#b": {},
    }),
    pairs: [
      ["A", "B"],
      ["A1", "B1"],
      ["A2", "B3"],
      ["A3", "B2"],
    ],
  },
] satisfies TestCase[];

interface TestCase {
  name: string;
  prev: VNode;
  next: VNode;
  pairs: [string, string][];
}

interface NodeChildren {
  [key: string]: NodeChildren;
}

function node(root: string, children: NodeChildren): VNode {
  const [name, key] = root.split("#", 2);

  const vnode = {
    key: key || name,
    children: Object.entries(children).map(([id, child]) => node(id, child)),
  } satisfies VNode;

  names.set(vnode, name);
  return vnode;
}

function normalizePairs(
  pairs: readonly (readonly [string, string])[],
): (readonly [string, string])[] {
  return [...pairs].sort(
    ([prevA, nextA], [prevB, nextB]) =>
      prevA.localeCompare(prevB) || nextA.localeCompare(nextB),
  );
}

function pairsOf(relation: Relation): (readonly [string, string])[] {
  return [...relation.pairs].map(({ prev, next }) => {
    const prevName = names.get(prev);
    const nextName = names.get(next);

    if (prevName === undefined || nextName === undefined) {
      throw new Error("Unknown VNode");
    }

    return [prevName, nextName] as const;
  });
}

describe("relate", () => {
  for (const testCase of cases) {
    it(testCase.name, () => {
      const relation = relate(testCase.prev, testCase.next);

      expect(normalizePairs(pairsOf(relation))).toEqual(
        normalizePairs(testCase.pairs),
      );
    });
  }
});
