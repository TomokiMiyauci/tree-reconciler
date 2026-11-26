import { describe, it, expect } from "bun:test";
import { relate } from "./relation.ts";
import { plan, type ChildrenPlan } from "./plan.ts";
import { n, label, type V } from "../test/helper.ts";

// 期待値の表記: matched は "prev>next"、unmatched は "+next"
function summarize(plans: readonly ChildrenPlan[]) {
  return plans
    .map((childrenPlan) => ({
      parent: `${label(childrenPlan.prevParent)}>${label(childrenPlan.nextParent)}`,
      arrangement: childrenPlan.arrangement.map((placement) =>
        placement.tag === "matched"
          ? `${label(placement.prev)}>${label(placement.next)}`
          : `+${label(placement.next)}`,
      ),
    }))
    .sort((a, b) => a.parent.localeCompare(b.parent));
}

const run = (prev: V, next: V) => summarize(plan(relate(prev, next)!));

const items = (...keys: string[]) =>
  n(
    "ul",
    keys.map((key) => n("li", [], key)),
  );

describe("plan", () => {
  it("arranges matched children in the new order", () => {
    expect(run(items("a", "b"), items("b", "a"))).toEqual([
      {
        parent: "ul>ul",
        arrangement: ["li#b>li#b", "li#a>li#a"],
      },
    ]);
  });

  it("marks a child without a counterpart as unmatched", () => {
    expect(run(items("a"), items("a", "x"))).toEqual([
      { parent: "ul>ul", arrangement: ["li#a>li#a", "+li#x"] },
    ]);
  });

  it("plans a parent when previous children are absent from the target", () => {
    expect(run(items("a", "b"), items("a"))).toEqual([
      {
        parent: "ul>ul",
        arrangement: ["li#a>li#a"],
      },
    ]);
  });

  it("plans added and missing children together when a child is replaced", () => {
    expect(run(items("old"), items("new"))).toEqual([
      {
        parent: "ul>ul",
        arrangement: ["+li#new"],
      },
    ]);
  });

  it("omits parents whose children did not change", () => {
    expect(run(items("a", "b"), items("a", "b"))).toEqual([]);
  });

  it("lists only the parents that changed", () => {
    const prev = n("div", [n("ul", [n("li", [], "a")], "u"), n("p", [], "q")]);
    const next = n("div", [
      n("ul", [n("li", [], "a"), n("li", [], "b")], "u"),
      n("p", [], "q"),
    ]);

    expect(run(prev, next).map((entry) => entry.parent)).toEqual(["ul#u>ul#u"]);
  });

  it("does not carry a child over to a different parent", () => {
    const prev = n("div", [n("p", [n("em")], "p"), n("q", [], "q")]);
    const next = n("div", [n("p", [], "p"), n("q", [n("em")], "q")]);

    expect(run(prev, next)).toEqual([
      { parent: "p#p>p#p", arrangement: [] },
      { parent: "q#q>q#q", arrangement: ["+em"] },
    ]);
  });

  it("matches same-key siblings in order and omits excess previous siblings", () => {
    expect(run(items("a", "a", "a"), items("a", "a"))).toEqual([
      {
        parent: "ul>ul",
        arrangement: ["li#a>li#a", "li#a>li#a"],
      },
    ]);
  });
});
