import { describe, expect, it } from "bun:test";
import { Branch } from "./tree.ts";

describe("Branch", () => {
  describe("of", () => {
    it("creates a branch with the given key and children", () => {
      const child = Branch.of("child");
      const branch = Branch.of("parent", [child]);

      expect(branch.key).toBe("parent");
      expect(branch.children).toEqual([child]);
    });

    it("creates a branch without children by default", () => {
      const branch = Branch.of("root");

      expect(branch.key).toBe("root");
      expect(branch.children).toEqual([]);
    });

    it("preserves the order of children", () => {
      const first = Branch.of("first");
      const second = Branch.of("second");
      const third = Branch.of("third");

      const branch = Branch.of("parent", [first, second, third]);

      expect(branch.children).toEqual([first, second, third]);
    });

    it("rejects duplicate children", () => {
      const child = Branch.of("child");

      expect(() => Branch.of("parent", [child, child])).toThrow(
        "Branch must belong to exactly one parent",
      );
    });

    it("rejects children that already belong to another parent", () => {
      const child = Branch.of("child");
      Branch.of("first-parent", [child]);

      expect(() => Branch.of("second-parent", [child])).toThrow(
        "Branch must belong to exactly one parent",
      );
    });

    it("does not adopt children when construction fails", () => {
      const available = Branch.of("available");
      const adopted = Branch.of("adopted");

      Branch.of("first-parent", [adopted]);

      expect(() => Branch.of("parent", [available, adopted])).toThrow();
      expect(() => Branch.of("second-parent", [available])).not.toThrow();
    });
  });
});
