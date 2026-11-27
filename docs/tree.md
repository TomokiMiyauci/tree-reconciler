# Tree

A tree is a hierarchical structure of nodes connected by parent-child relationships. This document describes the structural properties of a tree, how node identity is represented, and how trees are built with `Branch`.

## Tree Structure

A tree is a rooted, connected, acyclic structure.

A node is an individual element of a tree. Nodes are connected through parent-child relationships. A tree consists of one root node and every node reachable from it.

Every node other than the root has exactly one parent. The root has no parent.

The children of each node have a defined order, which makes a tree an ordered rooted tree.

## Identity

Identity describes whether two nodes represent the same logical entity.
Each node has a **key**, a string that represents its identity. Every node must have one.

- Nodes with the same key represent the same logical identity.
- Nodes with different keys represent different logical identities.

Nodes with the same identity are matched during updates and reused when the tree is restructured.

Keys do not need to be unique. Multiple nodes may share a key, even among siblings. How nodes with duplicate keys are matched, and the scope in which matching takes place, are defined in [reconciler](./reconciler.md).

## Branch

`Branch` is the data type used to build trees. It is the only way to construct and represent a tree in this library.

A `Branch` represents a single node together with the subtree rooted at it. A complete tree is represented by a single root `Branch` whose descendants are represented by its children.

A `Branch` holds only a key and its ordered children. Metadata is not part of a `Branch`.

### Immutability

A `Branch` is immutable. Its key and children cannot be changed after construction.

Uniqueness

Each `Branch` instance can be used only once within a tree.

This is an implementation constraint of this library, not an inherent property of trees.

`Branch.of` enforces this constraint and throws if a child already has a parent or appears more than once in the same `children` array.

For example, reusing a child that already belongs to another branch throws:

```ts
const child = Branch.of("child");

const first = Branch.of("first", [child]);

// Throws: child is already owned by first.
const second = Branch.of("second", [child]);
```

Passing the same child more than once also throws:

```ts
const child = Branch.of("child");

// Throws: child appears more than once.
const parent = Branch.of("parent", [child, child]);
```

To represent the same logical entity in different trees, create separate Branch instances with the same key.

### Cost

`Branch.of` runs in time proportional to the number of direct `children`. It does not depend on the size of their subtrees, so trees can be composed bottom-up without re-validating descendants.

### API

#### `Branch.of(key, children?)`

Creates a new `Branch`. Each call returns a new instance.

- `key`: The node's key.
- `children`: The node's ordered children. Optional; defaults to an empty array.

```ts
// A branch without children.
const leaf = Branch.of("leaf");

// Keys represent identity.
const list = Branch.of("list", [Branch.of("li:a"), Branch.of("li:b")]);

const tree = Branch.of("root", [
  Branch.of("header"),
  Branch.of("main", [Branch.of("article"), Branch.of("sidebar")]),
  Branch.of("footer"),
]);
```
