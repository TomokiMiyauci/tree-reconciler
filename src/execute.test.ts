import { describe, it, expect } from "bun:test";
import fc from "fast-check";
import { relate, type Pair, type Relation } from "../src/relation";
import { plan, replace } from "../src/plan";
import { script } from "../src/script";
import { execute, type Binding } from "../src/operation";
import {
  n,
  label,
  show,
  showHost,
  fakeHost,
  type FNode,
  type V,
} from "../test/helper";

function setup(prev: V, preexisting: FNode[] = []) {
  const env = fakeHost();
  for (const x of preexisting) {
    x.parent = env.container;
    env.container.children.push(x);
  }
  const binding: Binding<FNode> = new WeakMap();
  // 初回マウント: 旧がないので replace(null, prev)
  execute(
    env.host,
    binding,
    env.container,
    new Set(),
    script(replace(null, prev)),
  );
  return { ...env, binding };
}

type Env = ReturnType<typeof setup>;

function patchTo(
  env: Env,
  prev: V,
  next: V,
  tweak: (pairs: ReadonlySet<Pair>) => ReadonlySet<Pair> = (p) => p,
) {
  const rel = relate(prev, next);
  execute(
    env.host,
    env.binding,
    env.container,
    tweak(rel.pairs),
    script(plan(rel)),
  );
}

// 木の中に現れる、ペアになっていない部分木の根(導出)
function roots(tree: V, matched: ReadonlySet<V>): V[] {
  const out: V[] = [];
  const walk = (v: V) => {
    if (!matched.has(v)) {
      out.push(v);
      return;
    }
    v.children.forEach(walk);
  };
  walk(tree);
  return out;
}

const count = (v: V): number =>
  1 + v.children.reduce((s, c) => s + count(c), 0);

describe("execute", () => {
  it("対応するノードは作り直さず、ホストのノードを引き継ぐ", () => {
    const p = n("ul", [n("li", [], "a"), n("li", [], "b")]);
    const q = n("ul", [n("li", [], "b"), n("li", [], "a")]);
    const env = setup(p);
    const before = new Map(
      p.children.map((c) => [label(c), env.binding.get(c)]),
    );
    const created = env.stats.created;

    patchTo(env, p, q);

    expect(env.stats.created).toBe(created);
    for (const c of q.children)
      expect(env.binding.get(c)).toBe(before.get(label(c)));
  });

  it("pairs の列挙順に依存しない", () => {
    const p = n("ul", [n("li", [], "a"), n("li", [], "b"), n("li", [], "c")]);
    const q = n("ul", [n("li", [], "c"), n("li", [], "x"), n("li", [], "a")]);
    const run = (reverse: boolean) => {
      const env = setup(p);
      patchTo(
        env,
        p,
        q,
        (pairs) => new Set(reverse ? [...pairs].reverse() : pairs),
      );
      return showHost(env.container.children[0]);
    };
    expect(run(true)).toBe(run(false));
    expect(run(true)).toBe(show(q));
  });

  it("create は部分木ごとに作る", () => {
    const p = n("ul", [n("li", [], "a")]);
    const q = n("ul", [n("li", [], "a"), n("li", [n("em")], "x")]);
    const env = setup(p);
    const base = env.stats.created;

    patchTo(env, p, q);

    expect(env.stats.created - base).toBe(2); // li#x と em
    expect(showHost(env.container.children[0])).toBe(show(q));
  });

  it("remove は部分木ごと外れる", () => {
    const p = n("ul", [n("li", [n("em")], "a"), n("li", [], "b")]);
    const q = n("ul", [n("li", [], "b")]);
    const env = setup(p);
    patchTo(env, p, q);
    expect(showHost(env.container.children[0])).toBe("ul(li#b)");
  });

  it("同じ参照を旧新の両方に置いても壊れない(静的部分木の再利用)", () => {
    const shared = n("em", [], "s");
    const p = n("div", [shared, n("p", [], "x")]);
    const q = n("div", [n("p", [], "x"), shared]);
    const env = setup(p);
    patchTo(env, p, q);
    expect(showHost(env.container.children[0])).toBe(show(q));
  });

  it("ルートの key が違うと、旧ルートを外して新ルートを新規に作る", () => {
    const p = n("div", [n("p")]);
    const q = n("section");
    const env = setup(p);
    const oldRoot = env.binding.get(p);
    const created = env.stats.created;

    patchTo(env, p, q);

    expect(env.container.children).toHaveLength(1);
    expect(showHost(env.container.children[0])).toBe("section");
    expect(env.binding.get(q)).not.toBe(oldRoot);
    expect(env.stats.created - created).toBe(1);
    expect(oldRoot!.parent).toBeNull();
  });

  it("初回マウントは container 直下に追加される", () => {
    const env = setup(n("ul", [n("li", [], "a")]));
    expect(showHost(env.container.children[0])).toBe("ul(li#a)");
  });

  it("container 内の管理外の要素は触らない", () => {
    const other: FNode = { label: "aside", children: [], parent: null };
    const p = n("div");
    const q = n("div", [n("p")]);
    const env = setup(p, [other]);

    patchTo(env, p, q);

    expect(env.container.children[0]).toBe(other);
    expect(env.container.children).toHaveLength(2);
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
            { selector: (e) => e.key, maxLength: 5 },
          ),
  });

// 呼ぶたびに新しい参照で木を作る
const build = (s: Spec, key?: string): V =>
  n(
    s.kind,
    s.kids.map((k) => build(k.spec, k.key)),
    key,
  );
// ルートは常に同じ kind / key にして、必ず対になるようにする
const rootOf = (s: Spec): V =>
  n(
    "root",
    s.kids.map((k) => build(k.spec, k.key)),
  );

describe("性質", () => {
  it("任意の旧木→新木で、ホスト上の木が新木と同形になる", () => {
    fc.assert(
      fc.property(spec(3), spec(3), (a, b) => {
        const p = rootOf(a);
        const q = rootOf(b);
        const env = setup(p);
        patchTo(env, p, q);
        expect(showHost(env.container.children[0])).toBe(show(q));
      }),
    );
  });

  it("ルートが違っても(置き換えでも)ホスト上の木が新木と同形になる", () => {
    fc.assert(
      fc.property(spec(3), spec(3), (a, b) => {
        const p = build(a);
        const q = build(b, "other");
        const env = setup(p);
        patchTo(env, p, q);
        expect(env.container.children).toHaveLength(1);
        expect(showHost(env.container.children[0])).toBe(show(q));
      }),
    );
  });

  it("連続して更新しても(prev を更新し続けても)同形を保つ", () => {
    fc.assert(
      fc.property(
        fc.array(spec(2), { minLength: 2, maxLength: 5 }),
        (specs) => {
          let cur = rootOf(specs[0]);
          const env = setup(cur);
          for (const s of specs.slice(1)) {
            const next = rootOf(s);
            patchTo(env, cur, next);
            cur = next;
            expect(showHost(env.container.children[0])).toBe(show(cur));
          }
        },
      ),
    );
  });

  it("relate の契約: pairs は一対一で、旧新の全ノードが pair か未対応の部分木に属する", () => {
    fc.assert(
      fc.property(spec(3), spec(3), (a, b) => {
        const p = rootOf(a);
        const q = rootOf(b);
        const r: Relation = relate(p, q);
        const prevMatched = new Set([...r.pairs].map((x) => x.prev));
        const nextMatched = new Set([...r.pairs].map((x) => x.next));

        expect(prevMatched.size).toBe(r.pairs.size);
        expect(nextMatched.size).toBe(r.pairs.size);

        const sub = (list: V[]) => list.reduce((s, v) => s + count(v), 0);
        expect(r.pairs.size + sub(roots(p, prevMatched))).toBe(count(p));
        expect(r.pairs.size + sub(roots(q, nextMatched))).toBe(count(q));
      }),
    );
  });

  it("移動の最小性: move は (kept の数 − 最長増加部分列) と一致する", () => {
    const lis = (xs: number[]) => {
      const t: number[] = [];
      for (const x of xs) {
        let lo = 0,
          hi = t.length;
        while (lo < hi) {
          const m = (lo + hi) >> 1;
          if (t[m] < x) lo = m + 1;
          else hi = m;
        }
        t[lo] = x;
      }
      return t.length;
    };
    fc.assert(
      fc.property(fc.shuffledSubarray([0, 1, 2, 3, 4, 5, 6, 7]), (perm) => {
        const keys = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => "k" + i);
        const p = n(
          "ul",
          keys.map((k) => n("li", [], k)),
        );
        const q = n(
          "ul",
          perm.map((i) => n("li", [], "k" + i)),
        );
        const moves = script(plan(relate(p, q))).filter(
          (o) => o.kind === "move",
        ).length;
        expect(moves).toBe(perm.length - lis(perm));
      }),
    );
  });
});
