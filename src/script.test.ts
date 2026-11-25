import { describe, it, expect } from "bun:test";
import { relate } from "../src/relation.ts";
import { plan } from "../src/plan.ts";
import { script, scriptRoot, type StructOp } from "../src/script.ts";
import { n, label, type V } from "../test/helper.ts";

const list = (...keys: string[]): V =>
  n(
    "ul",
    keys.map((key) => n("li", [], key)),
  );

const opsBetween = (before: V, after: V) =>
  script(plan(relate(before, after)!));
const ops = (before: string[], after: string[]) =>
  opsBetween(list(...before), list(...after));
const kinds = (before: string[], after: string[]) =>
  ops(before, after).map((op) => op.kind);

type Of<K extends StructOp["kind"]> = Extract<StructOp, { kind: K }>;
const only = <K extends StructOp["kind"]>(operations: StructOp[], kind: K) =>
  operations.filter((op): op is Of<K> => op.kind === kind);

describe("script", () => {
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
    expect(kinds(["a", "b", "c", "d"], ["d", "a", "b", "c"])).toEqual(["move"]);
  });

  it("全反転(n=4)の move は 3 回", () => {
    expect(
      only(ops(["a", "b", "c", "d"], ["d", "c", "b", "a"]), "move"),
    ).toHaveLength(3);
  });

  it("remove は旧側、create の対象とアンカーは新側のノードを指す", () => {
    const prev = list("a", "b");
    const next = list("a", "x");
    const operations = opsBetween(prev, next);
    const [removal] = only(operations, "remove");
    const [creation] = only(operations, "create");
    expect(prev.children).toContain(removal.node);
    expect(next.children).toContain(creation.node);
    expect(creation.at.parent).toBe(next);
  });

  it("同じ親の操作は後ろから並ぶ", () => {
    const creations = only(ops(["a"], ["x", "y", "a"]), "create");
    expect(creations.map((op) => label(op.node))).toEqual(["li#y", "li#x"]);
  });

  it("アンカーの before は新側の次の兄弟を指す", () => {
    const creations = only(ops(["a"], ["x", "y", "a"]), "create");
    expect(creations.map((op) => op.at.before && label(op.at.before))).toEqual([
      "li#a",
      "li#y",
    ]);
  });

  it("remove は create / move より先に並ぶ", () => {
    const kindList = ops(["a", "b", "c"], ["c", "a", "x"]).map((op) => op.kind);
    const firstOther = kindList.findIndex((kind) => kind !== "remove");
    expect(kindList.lastIndexOf("remove")).toBeLessThan(firstOther);
  });

  it("入れ子: 変化した親の操作だけが出る", () => {
    const prev = n("div", [n("ul", [n("li", [], "a")], "u"), n("p", [], "q")]);
    const next = n("div", [
      n("ul", [n("li", [], "a"), n("li", [], "b")], "u"),
      n("p", [], "q"),
    ]);
    const operations = opsBetween(prev, next);
    expect(operations.map((op) => op.kind)).toEqual(["create"]);
    expect(label(only(operations, "create")[0].node)).toBe("li#b");
  });
});

describe("scriptRoot", () => {
  it("初回マウント: create 1つだけ、parent が null のアンカー", () => {
    const root = list("a");
    expect(scriptRoot({ removed: null, added: root })).toEqual([
      { kind: "create", node: root, at: { parent: null, before: null } },
    ]);
  });

  it("unmount: remove 1つだけ", () => {
    const root = list("a");
    expect(scriptRoot({ removed: root, added: null })).toEqual([
      { kind: "remove", node: root },
    ]);
  });

  it("ルート置換: remove の後に create", () => {
    const prev = n("div");
    const next = n("section");
    const operations = scriptRoot({ removed: prev, added: next });
    expect(operations.map((op) => op.kind)).toEqual(["remove", "create"]);
    expect(only(operations, "remove")[0].node).toBe(prev);
    expect(only(operations, "create")[0].node).toBe(next);
    expect(only(operations, "create")[0].at.parent).toBeNull();
  });

  it("ルートの key が違うと relate は null を返す", () => {
    expect(relate(n("div"), n("section"))).toBeNull();
  });
});
