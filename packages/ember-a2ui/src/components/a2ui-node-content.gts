import Component from '@glimmer/component';
import {
  isComponentNode,
  isWritable,
  ResolvedBinding,
  type ComponentNode,
} from '@a2ui/web_core';
import { SignalCell } from '../utils/signal-bridge.ts';
import type {
  EmberCatalogComponent,
  EmberComponentArgs,
} from '../define-component.ts';

type Plain = Record<string, unknown>;

function isPlainObject(value: unknown): value is Plain {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

function toViewValue(value: unknown): unknown {
  if (isComponentNode(value)) return value;
  if (Array.isArray(value)) return value.map(toViewValue);
  if (isPlainObject(value)) return toViewProps(value);
  return value;
}

/**
 * Converts one object level of node props: each `ResolvedBinding` becomes
 * `key: value` plus a `set<Key>` setter (a no-op when read-only).
 */
export function toViewProps(props: Plain): Plain {
  const result: Plain = {};
  for (const [key, inner] of Object.entries(props)) {
    if (inner instanceof ResolvedBinding) {
      result[key] = toViewValue(inner.value as unknown);
      result[`set${key.charAt(0).toUpperCase()}${key.slice(1)}`] = isWritable(
        inner,
      )
        ? inner.set
        : () => {};
    } else {
      result[key] = toViewValue(inner);
    }
  }
  return result;
}

function collectChildren(value: unknown, out: ComponentNode[]): void {
  if (isComponentNode(value)) out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectChildren(v, out));
  else if (value instanceof ResolvedBinding) collectChildren(value.value, out);
  else if (isPlainObject(value))
    Object.values(value).forEach((v) => collectChildren(v, out));
}

interface A2uiNodeContentSignature {
  Args: {
    node: ComponentNode;
    component: EmberCatalogComponent;
  };
}

/**
 * Invokes an author's Glimmer component for one node, feeding it the node's
 * autotracked props. Rendered into the host element by `A2uiSurface`.
 * Create a new one per node object (the signal subscription is per node).
 */
export default class A2uiNodeContent extends Component<A2uiNodeContentSignature> {
  cell = new SignalCell<Plain>(this, this.args.node.props);

  get bindings(): Plain {
    return this.cell.value;
  }

  get props(): EmberComponentArgs['props'] {
    return toViewProps(this.cell.value);
  }

  buildChild = (
    ref: string | ComponentNode,
    basePath?: string,
  ): ComponentNode | undefined => {
    if (typeof ref !== 'string') return ref;
    const children: ComponentNode[] = [];
    collectChildren(this.cell.value, children);
    const wanted = basePath ?? this.args.node.dataPath;
    const matches = children.filter((c) => c.componentId === ref);
    return matches.find((c) => c.dataPath === wanted) ?? matches[0];
  };

  <template>
    {{#let @component as |Impl|}}
      <Impl
        @props={{this.props}}
        @bindings={{this.bindings}}
        @node={{@node}}
        @buildChild={{this.buildChild}}
      />
    {{/let}}
  </template>
}
