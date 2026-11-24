import { describe, it, expect } from "bun:test";
import { relate, type Assign } from "./relation";
import { domIdentity } from "./dom";
import { n } from "../test/helper";

describe("relate", () => {
  it("キーが一致するノードを、並べ替えがあっても対にする", () => {
    const [a, b, c] = ["a", "b", "c"].map((k) => n("li", [], k));
    const [a2, b2, c2] = ["a", "b", "c"].map((k) => n("li", [], k));
    const p = n("ul", [a, b, c]);
    const q = n("ul", [c2, a2, b2]);
    const r = relate(p, q, domIdentity);

    expect(r.pairs.size).toBe(4);

    const nextOf = new Map([...r.pairs].map((x) => [x.prev, x.next]));
    expect(nextOf.get(a)).toBe(a2);
    expect(nextOf.get(b)).toBe(b2);
    expect(nextOf.get(c)).toBe(c2);
    expect(nextOf.get(p)).toBe(q);
  });

  it("旧側のみ・新側のみは部分木の根として出る(子は単独で出ない)", () => {
    const b = n("li", [n("em")], "b");
    const x = n("li", [n("strong")], "x");
    const r = relate(
      n("ul", [n("li", [], "a"), b]),
      n("ul", [n("li", [], "a"), x]),
      domIdentity,
    );
  });

  it("kind が違えば同じキーでも対にならない", () => {
    const r = relate(
      n("ul", [n("li", [], "a")]),
      n("ul", [n("div", [], "a")]),
      domIdentity,
    );
    expect(r.pairs.size).toBe(1); // ul のみ
  });

  it("キーなし同士は同じ kind なら出現順に対にする", () => {
    const [s1, s2] = [n("span"), n("span")];
    const [t1, t2] = [n("span"), n("span")];
    const r = relate(n("p", [s1, s2]), n("p", [t1, t2]), domIdentity);
    const m = new Map([...r.pairs].map((x) => [x.next, x.prev]));
    expect(m.get(t1)).toBe(s1);
    expect(m.get(t2)).toBe(s2);
  });

  it("キーなしの旧とキーありの新は対にならない(同一性定義の帰結)", () => {
    const r = relate(
      n("main", [n("div")]),
      n("main", [n("div", [], "a")]),
      domIdentity,
    );
    expect(r.pairs.size).toBe(1);
  });

  it("対称性: prev と next を入れ替えても成立し、only が入れ替わる", () => {
    const p = n("ul", [n("li", [], "a"), n("li", [], "b")]);
    const q = n("ul", [n("li", [], "b")]);
    const fwd = relate(p, q, domIdentity);
    const bwd = relate(q, p, domIdentity);
    expect(fwd.pairs.size).toBe(bwd.pairs.size);
  });

  it("ルートの同一性が合わなければ例外", () => {
    expect(() => relate(n("div"), n("span"), domIdentity)).toThrow(
      "root identity mismatch",
    );
  });

  describe("Assign の契約違反は境界で検出される", () => {
    const p = n("ul", [n("li", [], "a"), n("li", [], "b")]);
    const q = n("ul", [n("li", [], "a"), n("li", [], "b")]);

    it("一対一でない", () => {
      const bad: Assign = (prev, next) => [
        { prev: prev[0], next: next[0] },
        { prev: prev[0], next: next[1] },
      ];
      expect(() => relate(p, q, domIdentity, bad)).toThrow();
    });
    it("同一でないものを対にする", () => {
      const bad: Assign = (prev, next) => [{ prev: prev[0], next: next[1] }];
      expect(() => relate(p, q, domIdentity, bad)).toThrow(
        "pair has different key",
      );
    });
    it("子でないノードを対にする", () => {
      const stranger = n("li", [], "a");
      const bad: Assign = (_, next) => [{ prev: stranger, next: next[0] }];
      expect(() => relate(p, q, domIdentity, bad)).toThrow("not a child pair");
    });
  });
});
