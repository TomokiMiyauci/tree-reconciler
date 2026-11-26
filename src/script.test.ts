import { describe, it, expect } from "bun:test";
import { relate } from "../src/relation.ts";
import { script, type StructOp } from "../src/script.ts";
import { n, label, type V } from "../test/helper.ts";

const list = (...keys: string[]): V =>
  n(
    "ul",
    keys.map((key) => n("li", [], key)),
  );

const opsBetween = (before: V, after: V) =>
  script(relate(before, after), before, after);

const ops = (before: string[], after: string[]) =>
  opsBetween(list(...before), list(...after));

const kinds = (before: string[], after: string[]) =>
  ops(before, after).map((op) => op.kind);

type Of<K extends StructOp["kind"]> = Extract<StructOp, { kind: K }>;

const only = <K extends StructOp["kind"]>(operations: StructOp[], kind: K) =>
  operations.filter((op): op is Of<K> => op.kind === kind);

describe("script", () => {
  it("produces no operations when the tree is unchanged", () => {
    expect(ops(["a", "b"], ["a", "b"])).toEqual([]);
  });

  it("creates one node at the end when appending", () => {
    const [op] = ops(["a", "b"], ["a", "b", "x"]);

    expect(op.kind).toBe("create");
    if (op.kind === "create") expect(op.at.before).toBeNull();
  });

  it("removes only the first node when removing the first child", () => {
    expect(kinds(["a", "b", "c"], ["b", "c"])).toEqual(["remove"]);
  });

  it("moves one node when moving it to the beginning", () => {
    expect(kinds(["a", "b", "c", "d"], ["d", "a", "b", "c"])).toEqual(["move"]);
  });

  it("uses three moves for a complete reversal of four nodes", () => {
    expect(
      only(ops(["a", "b", "c", "d"], ["d", "c", "b", "a"]), "move"),
    ).toHaveLength(3);
  });

  it("references previous nodes for removal and next nodes for creation", () => {
    const prev = list("a", "b");
    const next = list("a", "x");
    const operations = opsBetween(prev, next);

    const [removal] = only(operations, "remove");
    const [creation] = only(operations, "create");

    expect(prev.children).toContain(removal.node);
    expect(next.children).toContain(creation.node);
    expect(creation.at.parent).toBe(next);
  });

  it("generates operations for each parent from right to left", () => {
    const creations = only(ops(["a"], ["x", "y", "a"]), "create");

    expect(creations.map((op) => label(op.node))).toEqual(["li#y", "li#x"]);
  });

  it("uses the next sibling in the target tree as the anchor", () => {
    const creations = only(ops(["a"], ["x", "y", "a"]), "create");

    expect(creations.map((op) => op.at.before && label(op.at.before))).toEqual([
      "li#a",
      "li#y",
    ]);
  });

  it("generates removals before creations and moves", () => {
    const kindList = ops(["a", "b", "c"], ["c", "a", "x"]).map((op) => op.kind);

    const firstOther = kindList.findIndex((kind) => kind !== "remove");

    expect(kindList.lastIndexOf("remove")).toBeLessThan(firstOther);
  });

  it("generates operations only for changed parents in nested trees", () => {
    const prev = n("div", [n("ul", [n("li", [], "a")], "u"), n("p", [], "q")]);
    const next = n("div", [
      n("ul", [n("li", [], "a"), n("li", [], "b")], "u"),
      n("p", [], "q"),
    ]);

    const operations = opsBetween(prev, next);

    expect(operations.map((op) => op.kind)).toEqual(["create"]);
    expect(label(only(operations, "create")[0].node)).toBe("li#b");
  });

  it("replaces the root when the roots have no correspondence", () => {
    const prev = n("div");
    const next = n("section");
    const operations = script(relate(prev, next), prev, next);

    expect(operations.map((op) => op.kind)).toEqual(["remove", "create"]);
    expect(only(operations, "remove")[0].node).toBe(prev);
    expect(only(operations, "create")[0].node).toBe(next);
    expect(only(operations, "create")[0].at.parent).toBeNull();
  });

  it("replaces the entire tree when the root keys differ", () => {
    const prev = list("a");
    const next = n("section");

    expect(relate(prev, next)).toBeNull();
    expect(opsBetween(prev, next).map((op) => op.kind)).toEqual([
      "remove",
      "create",
    ]);
  });
});
