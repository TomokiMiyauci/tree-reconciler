import { describe, it, expect } from "bun:test";
import { relate } from "../src/relation";
import { plan, replace } from "../src/plan";
import { script, type StructOp } from "../src/script";
import { n, label, type V } from "../test/helper";

const list = (...keys: string[]): V =>
  n(
    "ul",
    keys.map((k) => n("li", [], k)),
  );

const ops = (a: string[], b: string[]) =>
  script(plan(relate(list(...a), list(...b))));
const kinds = (a: string[], b: string[]) => ops(a, b).map((o) => o.kind);

type Of<K extends StructOp["kind"]> = Extract<StructOp, { kind: K }>;
const only = <K extends StructOp["kind"]>(out: StructOp[], kind: K) =>
  out.filter((o): o is Of<K> => o.kind === kind);

describe("script", () => {
  describe("patch", () => {
    it("変化なしなら操作なし", () => {
      expect(ops(["a", "b"], ["a", "b"])).toEqual([]);
    });

    it("末尾追加: create 1つだけ、アンカーは末尾", () => {
      const [op] = ops(["a", "b"], ["a", "b", "x"]);
      expect(op.kind).toBe("create");
      if (op.kind === "create") expect(op.at.before).toBeNull();
    });

    it("先頭削除: remove のみ", () => {
      expect(kinds(["a", "b", "c"], ["b", "c"])).toEqual(["remove"]);
    });

    it("先頭への1要素の移動は move 1つで済む", () => {
      expect(kinds(["a", "b", "c", "d"], ["d", "a", "b", "c"])).toEqual([
        "move",
      ]);
    });

    it("全反転(n=4)の move は 3 回(最長増加部分列の長さ1を除く)", () => {
      expect(
        only(
          script(
            plan(relate(list("a", "b", "c", "d"), list("d", "c", "b", "a"))),
          ),
          "move",
        ),
      ).toHaveLength(3);
    });

    it("remove は旧側、create の対象とアンカーは新側のノードを指す", () => {
      const p = list("a", "b");
      const q = list("a", "x");
      const out = script(plan(relate(p, q)));
      const [rm] = only(out, "remove");
      const [cr] = only(out, "create");
      expect(p.children).toContain(rm.node);
      expect(q.children).toContain(cr.node);
      expect(cr.at.parent).toBe(q);
    });

    it("同じ親の操作は後ろから並ぶ(次の兄弟が先に配置される)", () => {
      const creates = only(ops(["a"], ["x", "y", "a"]), "create");
      expect(creates.map((o) => label(o.node))).toEqual(["li#y", "li#x"]);
    });

    it("アンカーの before は新側の次の兄弟を指す", () => {
      const p = list("a");
      const q = list("x", "y", "a");
      const creates = only(script(plan(relate(p, q))), "create");
      // y は a の前、x は y の前
      expect(creates.map((o) => o.at.before && label(o.at.before))).toEqual([
        "li#a",
        "li#y",
      ]);
    });

    it("remove は create / move より先に並ぶ", () => {
      const out = ops(["a", "b", "c"], ["c", "a", "x"]);
      const firstNonRemove = out.findIndex((o) => o.kind !== "remove");
      const lastRemove = out.map((o) => o.kind).lastIndexOf("remove");
      expect(lastRemove).toBeLessThan(firstNonRemove);
    });

    it("入れ子: 変化した親の操作だけが出る", () => {
      const p = n("div", [n("ul", [n("li", [], "a")], "u"), n("p", [], "q")]);
      const q = n("div", [
        n("ul", [n("li", [], "a"), n("li", [], "b")], "u"),
        n("p", [], "q"),
      ]);
      const out = script(plan(relate(p, q)));
      expect(out.map((o) => o.kind)).toEqual(["create"]);
      expect(label(only(out, "create")[0].node)).toBe("li#b");
    });
  });

  describe("replace", () => {
    it("初回マウント: create 1つだけ、parent が null のアンカー", () => {
      const root = list("a");
      const out = script(replace(null, root));
      expect(out).toEqual([
        { kind: "create", node: root, at: { parent: null, before: null } },
      ]);
    });

    it("unmount: remove 1つだけ", () => {
      const root = list("a");
      expect(script(replace(root, null))).toEqual([
        { kind: "remove", node: root },
      ]);
    });

    it("ルート交換: remove の後に create", () => {
      const p = n("div");
      const q = n("section");
      const out = script(plan(relate(p, q)));
      expect(out.map((o) => o.kind)).toEqual(["remove", "create"]);
      expect(only(out, "remove")[0].node).toBe(p);
      expect(only(out, "create")[0].node).toBe(q);
      expect(only(out, "create")[0].at.parent).toBeNull();
    });

    it("両方 null なら操作なし", () => {
      expect(script(replace(null, null))).toEqual([]);
    });
  });
});
