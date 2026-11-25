import { describe, it, expect } from "bun:test";
import { relate } from "./relation";
import { plan } from "./plan";
import { script } from "./script";
import { domIdentity } from "./dom";
import { n, type V } from "../test/helper";

const list = (...keys: string[]): V =>
  n(
    "ul",
    keys.map((k) => n("li", [], k)),
  );
const ops = (a: string[], b: string[]) =>
  script(plan(relate(list(...a), list(...b), domIdentity)));
const kinds = (a: string[], b: string[]) => ops(a, b).map((o) => o.kind);

describe("script", () => {
  it("変化なしなら操作なし", () => {
    expect(ops(["a", "b"], ["a", "b"])).toEqual([]);
  });

  it("末尾追加: create 1つだけ、アンカーは末尾", () => {
    const [op] = ops(["a", "b"], ["a", "b", "x"]);
    expect(op.kind).toBe("create");
    if (op.kind === "create") expect(op.at?.before).toBeNull();
  });

  it("先頭削除: remove のみ", () => {
    expect(kinds(["a", "b", "c"], ["b", "c"])).toEqual(["remove"]);
  });

  it("先頭への1要素の移動は move 1つで済む", () => {
    expect(kinds(["a", "b", "c", "d"], ["d", "a", "b", "c"])).toEqual(["move"]);
  });

  it("全反転(n=4)の move は 3 回(最長増加部分列の長さ1を除く)", () => {
    expect(
      kinds(["a", "b", "c", "d"], ["d", "c", "b", "a"]).filter(
        (k) => k === "move",
      ),
    ).toHaveLength(3);
  });

  it("remove は旧側、create の対象とアンカーは新側のノードを指す", () => {
    const p = list("a", "b");
    const q = list("a", "x");
    const rel = relate(p, q, domIdentity);
    const out = script(plan(rel));
    const rm = out.find((o) => o.kind === "remove")!;
    const cr = out.find((o) => o.kind === "create")!;
    expect(p.children).toContain((rm as any).node);
    expect(q.children).toContain((cr as any).node);
    expect((cr as any).at.parent).toBe(q);
  });

  it("同じ親の操作は後ろから並ぶ(次の兄弟が先に配置される)", () => {
    const out = ops(["a"], ["x", "y", "a"]);
    const creates = out.filter((o) => o.kind === "create") as any[];
    expect(creates.map((o) => o.node.identity.key)).toEqual(["y", "x"]);
  });
});
