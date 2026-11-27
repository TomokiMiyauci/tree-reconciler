# Reconciler

The `Reconciler` manages tree updates. It retains the **Current Tree** and compares it with the **Next Tree** to determine the changes required between them.

The **Current Tree** is the tree currently retained by the Reconciler. The **Next Tree** is the tree passed to `update` as the desired next state.

Once an update is complete, the Next Tree becomes the new Current Tree.

The Reconciler deals with tree structure: which Nodes exist and in what order they appear. Metadata such as attributes and properties is outside its scope.

## Matching

The Reconciler matches Nodes between the Current Tree and the Next Tree.

### Rules

- **By identity**: Nodes with the same Key are matched.
- **Roots first**: The roots are matched first.
- **Children of matched parents only**: The Reconciler matches the Children of corresponding parents. Descendants of unmatched parents are not considered for matching.
- **One-to-one**: Each Node can be matched with at most one Node in the other Tree.
- **Duplicate keys**: Sibling Nodes with the same Key are matched in their order of appearance.

### Matched Pairs

The Reconciler notifies the Host of pairs of matched Nodes between the Current Tree and the Next Tree.

This allows the Host to associate the same underlying entity with the corresponding Node in the Next Tree.

## Changes

The Reconciler identifies structural changes between the Current Tree and the Next Tree.

### Create

A Create change indicates that a Node exists in the Next Tree but has no corresponding Node in the Current Tree.

The Reconciler notifies the Host to create the Node and specifies its position in the tree.

### Move

A Move change indicates that a matched Node has changed its position in the tree.

The Reconciler notifies the Host to move the Node and specifies its new position.

### Remove

A Remove change indicates that a Node exists in the Current Tree but has no corresponding Node in the Next Tree.

The Reconciler notifies the Host to remove the Node.

## Lifecycle

The `Reconciler` retains the Current Tree between updates. Each call to `update()` provides a Next Tree to compare against it.

```ts
const reconciler = new Reconciler(host);

reconciler.update(firstTree);
reconciler.update(nextTree);
```

Once an update is complete, the Next Tree becomes the new Current Tree and is used as the basis for the next update.

Passing `null` to `update()` clears the Current Tree.

```ts
reconciler.update(null);
```

After the Current Tree is cleared, the Reconciler retains no tree. The next update creates a new tree from scratch.
