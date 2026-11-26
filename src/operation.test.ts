import { describe, it, expect } from "bun:test";
import fc from "fast-check";
import { relate, type Counterparts } from "./relation.ts";
import { script, scriptRoot } from "./script.ts";
import { rootOperations } from "./util.ts";
import { execute, type Binding, type Observer } from "./operation.ts";
import {
  n,
  label,
  show,
  showHost,
  fakeHost,
  recorder,
  type FNode,
  type V,
} from "../test/helper.ts";

function setup(
  prev: V,
  preexisting: FNode[] = [],
  observer: Observer<FNode> = {},
) {
  const env = fakeHost();
  for (const existing of preexisting) {
    existing.parent = env.container;
    env.container.children.push(existing);
  }
  const binding: Binding<FNode> = new WeakMap();
  execute(
    env.host,
    binding,
    env.container,
    null,
    rootOperations({ prev: null, next: prev }),
    observer,
  );
  return { ...env, binding, observer };
}

type Env = ReturnType<typeof setup>;

function patchTo(
  env: Env,
  prev: V,
  next: V,
  tweak: (counterparts: Counterparts) => Counterparts = (value) => value,
) {
  const counterparts = relate(prev, next);
  if (counterparts) {
    execute(
      env.host,
      env.binding,
      env.container,
      tweak(counterparts),
      script(counterparts, prev, next),
      env.observer,
    );
  } else {
    execute(
      env.host,
      env.binding,
      env.container,
      null,
      scriptRoot({ prev, next }),
      env.observer,
    );
  }
}

const reversed = (counterparts: Counterparts): Counterparts =>
  new Map([...counterparts].reverse());

// 木の中の、対になっていない部分木の根(導出)
function unmatchedRoots(tree: V, matched: ReadonlySet<V>): V[] {
  const roots: V[] = [];
  const walk = (vnode: V) => {
    if (!matched.has(vnode)) {
      roots.push(vnode);
      return;
    }
    vnode.children.forEach(walk);
  };
  walk(tree);
  return roots;
}

const countNodes = (vnode: V): number =>
  1 + vnode.children.reduce((sum, child) => sum + countNodes(child), 0);

describe("execute", () => {
  it("対応するノードは作り直さず、ホストのノードを引き継ぐ", () => {
    const prev = n("ul", [n("li", [], "a"), n("li", [], "b")]);
    const next = n("ul", [n("li", [], "b"), n("li", [], "a")]);
    const env = setup(prev);
    const before = new Map(
      prev.children.map((child) => [label(child), env.binding.get(child)]),
    );
    const created = env.stats.created;

    patchTo(env, prev, next);

    expect(env.stats.created).toBe(created);
    for (const child of next.children) {
      expect(env.binding.get(child)).toBe(before.get(label(child)));
    }
  });

  it("対応表の列挙順に依存しない", () => {
    const prev = n("ul", [
      n("li", [], "a"),
      n("li", [], "b"),
      n("li", [], "c"),
    ]);
    const next = n("ul", [
      n("li", [], "c"),
      n("li", [], "x"),
      n("li", [], "a"),
    ]);
    const run = (tweak: (value: Counterparts) => Counterparts) => {
      const env = setup(prev);
      patchTo(env, prev, next, tweak);
      return showHost(env.container.children[0]);
    };
    expect(run(reversed)).toBe(run((value) => value));
    expect(run(reversed)).toBe(show(next));
  });

  it("create は部分木ごとに作る", () => {
    const prev = n("ul", [n("li", [], "a")]);
    const next = n("ul", [n("li", [], "a"), n("li", [n("em")], "x")]);
    const env = setup(prev);
    const base = env.stats.created;

    patchTo(env, prev, next);

    expect(env.stats.created - base).toBe(2);
    expect(showHost(env.container.children[0])).toBe(show(next));
  });

  it("remove は部分木ごと外れる", () => {
    const prev = n("ul", [n("li", [n("em")], "a"), n("li", [], "b")]);
    const next = n("ul", [n("li", [], "b")]);
    const env = setup(prev);
    patchTo(env, prev, next);
    expect(showHost(env.container.children[0])).toBe("ul(li#b)");
  });

  it("ルートの key が違うと、旧ルートを外して新ルートを新規に作る", () => {
    const prev = n("div", [n("p")]);
    const next = n("section");
    const env = setup(prev);
    const oldRoot = env.binding.get(prev);
    const created = env.stats.created;

    patchTo(env, prev, next);

    expect(env.container.children).toHaveLength(1);
    expect(showHost(env.container.children[0])).toBe("section");
    expect(env.binding.get(next)).not.toBe(oldRoot);
    expect(env.stats.created - created).toBe(1);
    expect(oldRoot!.parent).toBeNull();
  });

  it("初回マウントは container 直下に追加される", () => {
    const env = setup(n("ul", [n("li", [], "a")]));
    expect(showHost(env.container.children[0])).toBe("ul(li#a)");
  });

  it("container 内の管理外の要素は触らない", () => {
    const other: FNode = { label: "aside", children: [], parent: null };
    const prev = n("div");
    const next = n("div", [n("p")]);
    const env = setup(prev, [other]);

    patchTo(env, prev, next);

    expect(env.container.children[0]).toBe(other);
    expect(env.container.children).toHaveLength(2);
  });
});

describe("observer", () => {
  it("初回マウントでは created が親から子の順に呼ばれる", () => {
    const { events, observer } = recorder();
    setup(n("ul", [n("li", [], "a")]), [], observer);
    expect(events).toEqual(["created ul", "created li#a"]);
  });

  it("created は新規ノードの部分木の全ノードに呼ばれる", () => {
    const { events, observer } = recorder();
    const prev = n("ul");
    const next = n("ul", [n("li", [n("em")], "x")]);
    const env = setup(prev, [], observer);
    events.length = 0;

    patchTo(env, prev, next);

    expect(events.filter((event) => event.startsWith("created"))).toEqual([
      "created li#x",
      "created em",
    ]);
  });

  it("matched は対になった全ペアに呼ばれ、新規ノードには呼ばれない", () => {
    const { events, observer } = recorder();
    const prev = n("ul", [n("li", [], "a")]);
    const next = n("ul", [n("li", [], "a"), n("li", [], "x")]);
    const env = setup(prev, [], observer);
    events.length = 0;

    patchTo(env, prev, next);

    const matched = events.filter((event) => event.startsWith("matched"));
    expect(matched.sort()).toEqual(["matched li#a>li#a", "matched ul>ul"]);
  });

  it("matched はホストノードの引き継ぎ後に呼ばれる", () => {
    const prev = n("ul", [n("li", [], "a")]);
    const next = n("ul", [n("li", [], "a")]);
    const seen: (FNode | undefined)[] = [];
    const env = setup(prev, [], {
      matched: (_prevNode, nextNode, hostNode) => {
        seen.push(hostNode);
        expect(env.binding.get(nextNode)).toBe(hostNode);
      },
    });
    const before = env.binding.get(prev.children[0]);

    patchTo(env, prev, next);

    expect(seen).toContain(before);
  });

  it("removed は取り除く部分木の全ノードに、除去の前に呼ばれる", () => {
    const attachedAtRemoval: boolean[] = [];
    const { events, observer: recording } = recorder();
    const prev = n("ul", [n("li", [n("em")], "a"), n("li", [], "b")]);
    const next = n("ul", [n("li", [], "b")]);
    const env = setup(prev, [], {
      ...recording,
      removed: (vnode, hostNode) => {
        recording.removed!(vnode, hostNode);
        attachedAtRemoval.push(hostNode.parent !== null);
      },
    });
    events.length = 0;

    patchTo(env, prev, next);

    expect(events.filter((event) => event.startsWith("removed"))).toEqual([
      "removed li#a",
      "removed em",
    ]);
    expect(attachedAtRemoval).toEqual([true, true]);
  });

  it("ルート置換では旧ルートの全ノードに removed、新ルートに created", () => {
    const { events, observer } = recorder();
    const prev = n("div", [n("p")]);
    const next = n("section");
    const env = setup(prev, [], observer);
    events.length = 0;

    patchTo(env, prev, next);

    expect(events).toEqual(["removed div", "removed p", "created section"]);
  });

  it("removed は旧の子孫のホストノードを引き継ぎ前の対応で渡す", () => {
    const prev = n("ul", [n("li", [n("em")], "a")]);
    const next = n("ul");
    const hostNodes = new Map<string, FNode>();
    const env = setup(prev, [], {
      removed: (vnode, hostNode) => hostNodes.set(label(vnode), hostNode),
    });
    const expectedEm = env.binding.get(prev.children[0].children[0]);

    patchTo(env, prev, next);

    expect(hostNodes.get("em")).toBe(expectedEm);
  });

  it("unmount 相当(removed のみ)で全ノードに removed が呼ばれる", () => {
    const { events, observer } = recorder();
    const root = n("ul", [n("li", [], "a")]);
    const env = setup(root, [], observer);
    events.length = 0;

    execute(
      env.host,
      env.binding,
      env.container,
      null,
      rootOperations({ prev: root, next: null }),
      observer,
    );

    expect(events).toEqual(["removed ul", "removed li#a"]);
    expect(env.container.children).toHaveLength(0);
  });
});

// ---- 性質ベース ----
type Spec = { kind: string; kids: { key: string; spec: Spec }[] };
const spec = (depth: number): fc.Arbitrary<Spec> =>
  fc.record({
    kind: fc.constantFrom("a", "b"),
    kids:
      depth === 0
        ? fc.constant([])
        : fc.uniqueArray(
            fc.record({
              key: fc.constantFrom("k1", "k2", "k3", "k4", "k5"),
              spec: spec(depth - 1),
            }),
            { selector: (entry) => entry.key, maxLength: 5 },
          ),
  });

const build = (value: Spec, key?: string): V =>
  n(
    value.kind,
    value.kids.map((kid) => build(kid.spec, kid.key)),
    key,
  );
const rootOf = (value: Spec): V =>
  n(
    "root",
    value.kids.map((kid) => build(kid.spec, kid.key)),
  );

describe("性質", () => {
  it("任意の旧木→新木で、ホスト上の木が新木と同形になる", () => {
    fc.assert(
      fc.property(spec(3), spec(3), (a, b) => {
        const prev = rootOf(a);
        const next = rootOf(b);
        const env = setup(prev);
        patchTo(env, prev, next);
        expect(showHost(env.container.children[0])).toBe(show(next));
      }),
    );
  });

  it("ルートが違っても、ホスト上の木が新木と同形になる", () => {
    fc.assert(
      fc.property(spec(3), spec(3), (a, b) => {
        const prev = build(a);
        const next = build(b, "other");
        const env = setup(prev);
        patchTo(env, prev, next);
        expect(env.container.children).toHaveLength(1);
        expect(showHost(env.container.children[0])).toBe(show(next));
      }),
    );
  });

  it("連続して更新しても同形を保つ", () => {
    fc.assert(
      fc.property(
        fc.array(spec(2), { minLength: 2, maxLength: 5 }),
        (specs) => {
          let current = rootOf(specs[0]);
          const env = setup(current);
          for (const value of specs.slice(1)) {
            const next = rootOf(value);
            patchTo(env, current, next);
            current = next;
            expect(showHost(env.container.children[0])).toBe(show(current));
          }
        },
      ),
    );
  });

  it("created と removed の通知数が、増減したノード数と一致する", () => {
    fc.assert(
      fc.property(spec(3), spec(3), (a, b) => {
        const prev = rootOf(a);
        const next = rootOf(b);
        const { events, observer } = recorder();
        const env = setup(prev, [], observer);
        events.length = 0;

        patchTo(env, prev, next);

        const counterparts = relate(prev, next)!;
        const matchedNext = new Set(counterparts.keys());
        const matchedPrev = new Set(counterparts.values());
        const added = unmatchedRoots(next, matchedNext)
          .map(countNodes)
          .reduce((sum, value) => sum + value, 0);
        const removed = unmatchedRoots(prev, matchedPrev)
          .map(countNodes)
          .reduce((sum, value) => sum + value, 0);

        expect(
          events.filter((event) => event.startsWith("created")),
        ).toHaveLength(added);
        expect(
          events.filter((event) => event.startsWith("removed")),
        ).toHaveLength(removed);
      }),
    );
  });

  it("relate の契約: 旧ノードは一度しか現れず、全ノードが対か未対応の部分木に属する", () => {
    fc.assert(
      fc.property(spec(3), spec(3), (a, b) => {
        const prev = rootOf(a);
        const next = rootOf(b);
        const counterparts = relate(prev, next)!;
        const matchedNext = new Set(counterparts.keys());
        const matchedPrev = new Set(counterparts.values());

        expect(matchedPrev.size).toBe(counterparts.size);

        const subtree = (roots: V[]) =>
          roots.reduce((sum, vnode) => sum + countNodes(vnode), 0);
        expect(
          counterparts.size + subtree(unmatchedRoots(prev, matchedPrev)),
        ).toBe(countNodes(prev));
        expect(
          counterparts.size + subtree(unmatchedRoots(next, matchedNext)),
        ).toBe(countNodes(next));
      }),
    );
  });

  it("移動の最小性: move は (matched の数 − 最長増加部分列) と一致する", () => {
    const lis = (values: number[]) => {
      const tails: number[] = [];
      for (const value of values) {
        let low = 0;
        let high = tails.length;
        while (low < high) {
          const middle = (low + high) >> 1;
          if (tails[middle] < value) low = middle + 1;
          else high = middle;
        }
        tails[low] = value;
      }
      return tails.length;
    };
    fc.assert(
      fc.property(fc.shuffledSubarray([0, 1, 2, 3, 4, 5, 6, 7]), (perm) => {
        const keys = [0, 1, 2, 3, 4, 5, 6, 7].map((index) => "k" + index);
        const prev = n(
          "ul",
          keys.map((key) => n("li", [], key)),
        );
        const next = n(
          "ul",
          perm.map((index) => n("li", [], "k" + index)),
        );
        const moves = script(relate(prev, next)!, prev, next).filter(
          (op) => op.kind === "move",
        ).length;
        expect(moves).toBe(perm.length - lis(perm));
      }),
    );
  });
});
