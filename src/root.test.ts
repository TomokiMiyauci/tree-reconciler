import { describe, it, expect } from "bun:test";
import { JSDOM } from "jsdom";
import { createRoot } from "./root";
import { DOMHost } from "./dom";
import { n, metas } from "../test/helper";

const setup = () => {
  const {
    window: { document },
  } = new JSDOM();
  const container = document.createElement("div");
  return {
    document,
    container,
    // n が登録する metas を DOMHost と共有する
    root: createRoot(new DOMHost(document, metas), container),
  };
};

describe("createRoot (JSDOM)", () => {
  it("初回マウントと更新", () => {
    const { container, root } = setup();
    root.render(n("section"));
    expect(container.innerHTML).toBe("<section></section>");
    root.render(n("section", [n("div")]));
    expect(container.innerHTML).toBe("<section><div></div></section>");
  });

  it("削除・作成が混在しても結果のHTMLが一致する", () => {
    const { container, root } = setup();
    root.render(
      n("section", [
        n("header", [n("span")]),
        n("main", [n("span"), n("div"), n("span")]),
      ]),
    );
    root.render(n("section", [n("header"), n("main", [n("div", [], "a")])]));
    expect(container.innerHTML).toBe(
      "<section><header></header><main><div></div></main></section>",
    );
  });

  it("キーが同じなら DOM ノードを再利用する", () => {
    const { container, root } = setup();
    root.render(n("main", [n("div", [], "a"), n("p", [], "b")]));
    const div = container.querySelector("div");

    root.render(n("main", [n("p", [], "b"), n("div", [], "a")]));

    expect(container.querySelector("div")).toBe(div);
    expect(container.innerHTML).toBe("<main><p></p><div></div></main>");
  });

  it("キーなし旧 div とキーあり新 div は再利用されない", () => {
    const { container, root } = setup();
    root.render(n("main", [n("div")]));
    const div = container.querySelector("div");
    root.render(n("main", [n("div", [], "a")]));
    expect(container.querySelector("div")).not.toBe(div);
  });

  it("ルートの kind が変わると旧ルートを外して新ルートを作る", () => {
    const { container, root } = setup();
    root.render(n("div", [n("p")]));
    const old = container.firstChild;
    root.render(n("section"));
    expect(container.innerHTML).toBe("<section></section>");
    expect(old!.parentNode).toBeNull();
  });

  it("同じルート VNode を再度渡しても壊れない", () => {
    const { container, root } = setup();
    const tree = n("ul", [n("li", [], "a")]);
    root.render(tree);
    root.render(tree);
    expect(container.innerHTML).toBe("<ul><li></li></ul>");
  });

  it("コンテナ内の他の要素には触れない", () => {
    const { document, container, root } = setup();
    const other = document.createElement("aside");
    container.appendChild(other);
    root.render(n("div"));
    root.render(n("div", [n("p")]));
    expect(container.firstChild).toBe(other);
    expect(container.innerHTML).toBe("<aside></aside><div><p></p></div>");
  });

  it("unmount でマウントしたDOMだけが消える", () => {
    const { document, container, root } = setup();
    const other = document.createElement("aside");
    container.appendChild(other);
    root.render(n("div"));
    root.unmount();
    expect(container.innerHTML).toBe("<aside></aside>");
  });

  it("unmount 後に再度 render できる", () => {
    const { container, root } = setup();
    root.render(n("div"));
    root.unmount();
    root.render(n("section"));
    expect(container.innerHTML).toBe("<section></section>");
  });

  it("未マウントでの unmount は無害", () => {
    const { container, root } = setup();
    root.unmount();
    expect(container.innerHTML).toBe("");
  });

  it("メタ未登録の VNode は分かりやすいエラーになる", () => {
    const { root } = setup();
    expect(() => root.render({ key: "x", children: [] })).toThrow("no DomMeta");
  });
});
