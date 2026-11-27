# tree-reconciler

Host-agnostic tree reconciler that computes structural changes between two trees and expresses them as declarative plans and operations.

## Usage

Create a `Reconciler` with a host implementation, then call `update` with the desired tree.

The reconciler compares the current tree with the new one and delegates the necessary structural operations to the host. Branches with matching keys are treated as the same logical nodes, allowing the host to reuse existing nodes even when their positions change.

```ts
import { Reconciler, Branch, type Host } from "@miyauci/tree-reconciler";

declare const host: Host;
const reconciler = new Reconciler(host);

const tree = Branch.of("root", [Branch.of("child1"), Branch.of("child2")]);

reconciler.update(tree);

const another = Branch.of("root", [Branch.of("child2"), Branch.of("child1")]);

reconciler.update(another);
```

In this example, the second update delegates the operations needed to reorder the children while preserving their identities.
