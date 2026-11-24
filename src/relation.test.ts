import { describe, it, expect } from "bun:test";
import { Identity, relate, type Relation } from "./relation.ts";
import { VNode } from "./tree.ts";

interface TestIdentity {
  name: string;
  key?: string;
}

const cases = [
  {
    name: "matches the root",
    prev: node("A#root", {}),
    next: node("B#root", {}),
    pairs: [["A", "B"]],
  },
  {
    name: "matches children with the same identity",
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
    name: "does not match children with different identities",
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
    name: "matches when a child is replaced",
    prev: node("A#root", {
      "A1#old": {},
    }),
    next: node("B#root", {
      "B1#new": {},
    }),
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
    name: "pairs same-key siblings by order even when mixed with other keys",
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
    name: "uses key, not name, to decide identity",
    prev: node("A#root", { "X#one": {} }),
    next: node("B#root", { "X#two": {} }),
    pairs: [["A", "B"]],
  },
  {
    name: "matches by key even when names differ",
    prev: node("A#root", { "P#same": {} }),
    next: node("B#root", { "Q#same": {} }),
    pairs: [
      ["A", "B"],
      ["P", "Q"],
    ],
  },

  {
    name: "matches keyless siblings by name",
    prev: node("A#root", { "span#": {}, "div#": {} }),
    next: node("B#root", { "div#": {}, "span#": {} }),
    pairs: [
      ["A", "B"],
      ["div", "div"],
      ["span", "span"],
    ],
  },

  {
    name: "matches a deeply nested identical tree",
    prev: node("A#r", { "A1#a": { "A2#b": { "A3#c": {} } } }),
    next: node("B#r", { "B1#a": { "B2#b": { "B3#c": {} } } }),
    pairs: [
      ["A", "B"],
      ["A1", "B1"],
      ["A2", "B2"],
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
] satisfies TestCase[];

interface TestCase {
  name: string;
  prev: VNode<TestIdentity>;
  next: VNode<TestIdentity>;
  pairs: [string, string][];
}

function normalizePairs(pairs: readonly (readonly [string, string])[]) {
  return [...pairs].sort(
    ([a1, b1], [a2, b2]) => a1.localeCompare(a2) || b1.localeCompare(b2),
  );
}

interface NodeChildren {
  [k: string]: NodeChildren;
}

function node(root: string, children: NodeChildren): VNode<TestIdentity> {
  const [name, key] = root.split("#", 2);

  return {
    identity: {
      name,
      key: key === "" ? undefined : key,
    },
    children: Object.entries(children).map(([id, child]) => node(id, child)),
  };
}

const identity = {
  key(id: TestIdentity): string {
    return id.key || id.name;
  },
} satisfies Identity<TestIdentity>;

function pairsOf(
  relation: Relation<TestIdentity>,
): (readonly [string, string])[] {
  return [...relation.pairs]
    .map(({ prev, next }) => [prev.identity.name, next.identity.name] as const)
    .toSorted(
      ([a1, b1], [a2, b2]) => a1.localeCompare(a2) || b1.localeCompare(b2),
    );
}

describe("relate", () => {
  for (const testCase of cases) {
    it(testCase.name, () => {
      const relation = relate(testCase.prev, testCase.next, identity);

      expect(normalizePairs(pairsOf(relation))).toEqual(
        normalizePairs(testCase.pairs),
      );
    });
  }
});
