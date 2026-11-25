export interface VNode {
  readonly key: string;
  readonly children: readonly VNode[];
}
