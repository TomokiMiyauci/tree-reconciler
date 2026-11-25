import { describe, it, expect } from "bun:test";
import { relate } from "./relation.ts";
import { plan, type ChildrenPlan } from "./plan.ts";
import { n, label, type V } from "../test/helper.ts";

// 期待値の表記: matched は "prev>next"、added は "+next"
function summarize(plans: readonly ChildrenPlan[]) {
  return plans
    .map((childrenPlan) => ({
      parent: `${label(childrenPlan.prevParent)}>${label(childrenPlan.nextParent)}`,
      arrangement: childrenPlan.arrangement.map((placement) =>
        placement.tag === "matched"
          ? `${label(placement.prev)}>${label(placement.next)}`
          : `+${label(placement.next)}`,
      ),
      removed: childrenPlan.removed.map(label).sort(),
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
        removed: [],
      },
    ]);
  });

  it("marks a child without a counterpart as added", () => {
    expect(run(items("a"), items("a", "x"))).toEqual([
      { parent: "ul>ul", arrangement: ["li#a>li#a", "+li#x"], removed: [] },
    ]);
  });

  it("lists previous children missing from the target as removed", () => {
    expect(run(items("a", "b"), items("a"))).toEqual([
      { parent: "ul>ul", arrangement: ["li#a>li#a"], removed: ["li#b"] },
    ]);
  });

  it("reports added and removed together when a child is replaced", () => {
    expect(run(items("old"), items("new"))).toEqual([
      { parent: "ul>ul", arrangement: ["+li#new"], removed: ["li#old"] },
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
      { parent: "p#p>p#p", arrangement: [], removed: ["em"] },
      { parent: "q#q>q#q", arrangement: ["+em"], removed: [] },
    ]);
  });

  it("assigns same-key siblings in order and removes the extra", () => {
    expect(run(items("a", "a", "a"), items("a", "a"))).toEqual([
      {
        parent: "ul>ul",
        arrangement: ["li#a>li#a", "li#a>li#a"],
        removed: ["li#a"],
      },
    ]);
  });
});
