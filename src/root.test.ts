import { describe, it, expect } from "bun:test";
import { JSDOM } from "jsdom";
import { createRoot } from "./root";
import { DOMHost } from "./dom";
import { n } from "../test/helper";

const setup = () => {
  const {
    window: { document },
  } = new JSDOM();
  const container = document.createElement("div");
  return {
    document,
    container,
    root: createRoot(new DOMHost(document), container),
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

  it("指定の使い方: 削除・作成が混在しても結果のHTMLが一致する", () => {
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

  it("キーなし旧 div とキーあり新 div は再利用されない(同一性定義の帰結)", () => {
    const { container, root } = setup();
    root.render(n("main", [n("div")]));
    const div = container.querySelector("div");
    root.render(n("main", [n("div", [], "a")]));
    expect(container.querySelector("div")).not.toBe(div);
  });

  it("ルートの kind が変わるとマウントし直す", () => {
    const { container, root } = setup();
    root.render(n("div", [n("p")]));
    root.render(n("section"));
    expect(container.innerHTML).toBe("<section></section>");
  });

  it("コンテナ内の他の要素には触れない", () => {
    const { document, container, root } = setup();
    const other = document.createElement("aside");
    container.appendChild(other);
    root.render(n("div"));
    root.render(n("div", [n("p")]));
    expect(container.firstChild).toBe(other);
  });

  it("unmount でマウントしたDOMだけが消える", () => {
    const { container, root } = setup();
    root.render(n("div"));
    root.unmount();
    expect(container.innerHTML).toBe("");
  });
});
