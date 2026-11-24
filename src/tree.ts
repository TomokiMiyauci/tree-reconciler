export interface VNode<T = unknown> {
  readonly identity: T;
  readonly children: readonly VNode<T>[];
}
