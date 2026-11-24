import { describe, it, expect } from "bun:test";
import { relate } from "./relation.ts";
import { plan } from "./plan.ts";
import { domIdentity } from "./dom";
import { n } from "../test/helper";

describe("plan", () => {
  it("並べ替え: 新しい順序どおりに kept が並ぶ", () => {
    const [a, b] = [n("li", [], "a"), n("li", [], "b")];
    const [a2, b2] = [n("li", [], "a"), n("li", [], "b")];
    const p = n("ul", [a, b]);
    const q = n("ul", [b2, a2]);
    const sp = plan(relate(p, q, domIdentity));

    expect(sp.plans).toHaveLength(1);
    expect(sp.plans[0].slots).toEqual([
      { tag: "kept", prev: b, next: b2 },
      { tag: "kept", prev: a, next: a2 },
    ]);
    expect(sp.plans[0].dropped).toEqual([]);
  });

  it("追加と削除は fresh と dropped に分かれる", () => {
    const [a, b] = [n("li", [], "a"), n("li", [], "b")];
    const [a2, x] = [n("li", [], "a"), n("li", [], "x")];
    const [cp] = plan(
      relate(n("ul", [a, b]), n("ul", [x, a2]), domIdentity),
    ).plans;

    expect(cp.slots).toEqual([
      { tag: "fresh", next: x },
      { tag: "kept", prev: a, next: a2 },
    ]);
    expect(cp.dropped).toEqual([b]);
  });

  it("子が変わらない親は plan に出ない", () => {
    const sp = plan(
      relate(
        n("ul", [n("li", [], "a")]),
        n("ul", [n("li", [], "a")]),
        domIdentity,
      ),
    );
    expect(sp.plans).toEqual([]);
  });

  it("入れ子: 変化した親だけが出る", () => {
    const p = n("div", [n("ul", [n("li", [], "a")], "u"), n("p", [], "q")]);
    const q = n("div", [
      n("ul", [n("li", [], "a"), n("li", [], "b")], "u"),
      n("p", [], "q"),
    ]);
    const sp = plan(relate(p, q, domIdentity));
    expect(sp.plans).toHaveLength(1);
    expect(sp.plans[0].parent.next.identity.kind).toBe("ul");
  });
});
