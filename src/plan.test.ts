import { describe, it, expect } from "bun:test";
import { relate } from "./relation.ts";
import { plan, replace, type StructPlan } from "./plan.ts";
import type { VNode } from "./tree.ts";

const weakmap = new WeakMap<VNode, { name: string }>();

function node(
  root: string,
  children: Record<string, Record<string, unknown>> = {},
): VNode {
  const [name, key] = root.split("#", 2);

  const vnode = {
    key: key || name,
    children: Object.entries(children).map(([id, child]) =>
      node(id, child as Record<string, Record<string, unknown>>),
    ),
  };

  weakmap.set(vnode, { name });

  return vnode;
}

const label = (v: VNode) => weakmap.get(v)!.name;

// 期待値の表記: kept は "prev>next"、fresh は "+next"
type PatchSummary = {
  parent: string; // "prev>next"
  slots: string[]; // 新しい順序どおり(順序に意味がある)
  dropped: string[]; // 順序に意味なし(ソートして比較)
};

function summarize(sp: StructPlan) {
  if (sp.kind === "replace") {
    return {
      kind: "replace" as const,
      dropped: sp.dropped ? label(sp.dropped) : null,
      fresh: sp.fresh ? label(sp.fresh) : null,
    };
  }
  const children: PatchSummary[] = sp.children
    .map((c) => ({
      parent: `${label(c.parent.prev)}>${label(c.parent.next)}`,
      slots: c.slots.map((s) =>
        s.tag === "kept"
          ? `${label(s.prev)}>${label(s.next)}`
          : `+${label(s.next)}`,
      ),
      dropped: c.dropped.map(label).sort(),
    }))
    .sort((a, b) => a.parent.localeCompare(b.parent));
  return { kind: "patch" as const, children };
}

const run = (prev: VNode, next: VNode) => summarize(plan(relate(prev, next)));

const cases = [
  {
    name: "reorders kept children in the new order",
    prev: node("A#root", { "A1#first": {}, "A2#second": {} }),
    next: node("B#root", { "B1#second": {}, "B2#first": {} }),
    expected: {
      kind: "patch",
      children: [{ parent: "A>B", slots: ["A2>B1", "A1>B2"], dropped: [] }],
    },
  },
  {
    name: "marks a new child as fresh",
    prev: node("A#root", { "A1#a": {} }),
    next: node("B#root", { "B1#a": {}, "B2#b": {} }),
    expected: {
      kind: "patch",
      children: [{ parent: "A>B", slots: ["A1>B1", "+B2"], dropped: [] }],
    },
  },
  {
    name: "marks a missing child as dropped",
    prev: node("A#root", { "A1#a": {}, "A2#b": {} }),
    next: node("B#root", { "B1#a": {} }),
    expected: {
      kind: "patch",
      children: [{ parent: "A>B", slots: ["A1>B1"], dropped: ["A2"] }],
    },
  },
  {
    name: "reports fresh and dropped together when a child is replaced",
    prev: node("A#root", { "A1#old": {} }),
    next: node("B#root", { "B1#new": {} }),
    expected: {
      kind: "patch",
      children: [{ parent: "A>B", slots: ["+B1"], dropped: ["A1"] }],
    },
  },
  {
    name: "omits parents whose children did not change",
    prev: node("A#root", { "A1#a": {}, "A2#b": {} }),
    next: node("B#root", { "B1#a": {}, "B2#b": {} }),
    expected: { kind: "patch", children: [] },
  },
  {
    name: "lists only the parents that changed in a nested tree",
    prev: node("A#root", {
      "A1#list": { "A2#x": {} },
      "A3#other": { "A4#y": {} },
    }),
    next: node("B#root", {
      "B1#list": { "B2#x": {}, "B3#z": {} },
      "B4#other": { "B5#y": {} },
    }),
    expected: {
      kind: "patch",
      children: [{ parent: "A1>B1", slots: ["A2>B2", "+B3"], dropped: [] }],
    },
  },
  {
    name: "plans each changed parent independently",
    prev: node("A#root", {
      "A1#p": { "A2#x": {} },
      "A3#q": { "A4#y": {} },
    }),
    next: node("B#root", {
      "B1#p": {},
      "B2#q": { "B3#y": {}, "B4#z": {} },
    }),
    expected: {
      kind: "patch",
      children: [
        { parent: "A1>B1", slots: [], dropped: ["A2"] },
        { parent: "A3>B2", slots: ["A4>B3", "+B4"], dropped: [] },
      ],
    },
  },
  {
    name: "does not carry a child over to a different parent",
    prev: node("A#root", { "A1#p": { "A2#child": {} }, "A3#q": {} }),
    next: node("B#root", { "B1#p": {}, "B2#q": { "B3#child": {} } }),
    expected: {
      kind: "patch",
      children: [
        { parent: "A1>B1", slots: [], dropped: ["A2"] },
        { parent: "A3>B2", slots: ["+B3"], dropped: [] },
      ],
    },
  },
  {
    name: "assigns same-key siblings in order and drops the extra",
    prev: node("A#root", { "A1#item": {}, "A2#item": {}, "A3#item": {} }),
    next: node("B#root", { "B1#item": {}, "B2#item": {} }),
    expected: {
      kind: "patch",
      children: [{ parent: "A>B", slots: ["A1>B1", "A2>B2"], dropped: ["A3"] }],
    },
  },
  {
    name: "replaces the root when its key differs",
    prev: node("A#one", { "A1#child": {} }),
    next: node("B#two", { "B1#child": {} }),
    expected: { kind: "replace", dropped: "A", fresh: "B" },
  },
] satisfies {
  name: string;
  prev: VNode;
  next: VNode;
  expected: ReturnType<typeof summarize>;
}[];

describe("plan", () => {
  for (const c of cases) {
    it(c.name, () => {
      expect(run(c.prev, c.next)).toEqual(c.expected);
    });
  }

  describe("replace", () => {
    it("builds a plan for the first mount (no dropped root)", () => {
      expect(summarize(replace(null, node("B#root")))).toEqual({
        kind: "replace",
        dropped: null,
        fresh: "B",
      });
    });

    it("builds a plan for unmount (no fresh root)", () => {
      expect(summarize(replace(node("A#root"), null))).toEqual({
        kind: "replace",
        dropped: "A",
        fresh: null,
      });
    });
  });

  it("keeps the identity of every kept pair (prev and next share a key)", () => {
    const sp = plan(
      relate(
        node("A#root", { "A1#a": {}, "A2#b": {} }),
        node("B#root", { "B1#b": {}, "B2#a": {}, "B3#c": {} }),
      ),
    );
    if (sp.kind !== "patch") throw new Error("expected patch");
    for (const c of sp.children)
      for (const s of c.slots)
        if (s.tag === "kept") expect(s.prev.key).toBe(s.next.key);
  });
});
