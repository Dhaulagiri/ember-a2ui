import type { ComponentLike } from '@glint/template';
import type { z } from 'zod';
import {
  Catalog,
  type ComponentApi,
  type ComponentNode,
  type FunctionApi,
  type FunctionImplementation,
} from '@a2ui/web_core';
import { basicCatalog as basicCatalogV1 } from '@a2ui/web_core/v1_0';
import { basicCatalog as basicCatalogV09 } from '@a2ui/web_core/v0_9/basic_catalog';
import {
  isWebComponentImplementation,
  type WebComponentImplementation,
} from '@a2ui/web_core/universal';
import { EmberHost } from './utils/ember-host.ts';

/** Arguments every Glimmer catalog component receives. */
export interface EmberComponentArgs<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Props extends Record<string, any> = Record<string, any>,
> {
  /**
   * The node's resolved, autotracked props. Bindings are unwrapped: a bound
   * prop `value` arrives as `value` plus a `setValue(v)` setter (a no-op for
   * read-only values). Child nodes (`child`, `children`, ...) arrive as
   * `ComponentNode`s: render them with `<A2uiNode @node={{...}} />`.
   * Action props are `() => void` closures.
   */
  props: Props;
  /** The raw node props (bindings still wrapped in `ResolvedBinding`/`WritableBinding`). Autotracked. */
  bindings: Record<string, unknown>;
  /** The resolved node. */
  node: ComponentNode;
  /**
   * Finds a child node among the node's props: by component id, or passes a
   * `ComponentNode` straight through. Returns `undefined` when not found.
   */
  buildChild: (
    ref: string | ComponentNode,
    basePath?: string,
  ) => ComponentNode | undefined;
}

export interface EmberComponentSignature<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Props extends Record<string, any> = Record<string, any>,
> {
  Args: EmberComponentArgs<Props>;
}

/** A Glimmer component usable as a catalog entry. */
export type EmberCatalogComponent<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Props extends Record<string, any> = Record<string, any>,
> = ComponentLike<EmberComponentSignature<Props>>;

/** A catalog entry rendered by a Glimmer component. */
export interface EmberComponentImplementation<
  Schema extends z.ZodTypeAny = z.ZodTypeAny,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Props extends Record<string, any> = Record<string, any>,
> extends WebComponentImplementation<Schema> {
  readonly component: EmberCatalogComponent<Props>;
}

export function isEmberComponentImplementation(
  value: unknown,
): value is EmberComponentImplementation {
  return (
    isWebComponentImplementation(value) &&
    'component' in value &&
    value.element.prototype instanceof EmberHost
  );
}

const tagNameCounts = new Map<string, number>();

/** `a2ui-ember-<name>`, with an incrementing suffix when names collide. */
function computeTagName(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const base = `a2ui-ember-${slug}`;
  const count = (tagNameCounts.get(base) ?? 0) + 1;
  tagNameCounts.set(base, count);
  return count === 1 ? base : `${base}-${count}`;
}

/**
 * Turns a Glimmer component into a catalog entry.
 *
 * The entry is a `WebComponentImplementation` whose custom element is an empty
 * host (one class per entry, `customElements` refuses to reuse a class). Lit
 * parents (a basic `Column`, say) create the host like any other element;
 * `A2uiSurface` then renders `component` into it with `{{in-element}}`.
 *
 * ```ts
 * const StatCard = defineEmberComponent({
 *   name: 'StatCard',
 *   schema: z.object({ label: DynamicStringSchema, value: DynamicStringSchema }),
 *   component: StatCardComponent,
 * });
 * const catalog = extendBasicCatalog('https://example.com/catalog.json', [StatCard]);
 * ```
 */
export function defineEmberComponent<
  Schema extends z.ZodTypeAny,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Props extends Record<string, any> = Record<string, any>,
>(options: {
  /** Component name as it appears in A2UI JSON (`"component": "<name>"`). */
  name: string;
  /** Zod schema of the component's props (without `id`/`component`). */
  schema: Schema;
  component: EmberCatalogComponent<Props>;
  /** Overrides the generated custom element tag name. */
  tagName?: string;
  /** Optional catalog metadata passed through to the entry. */
  allowedParents?: string[];
  allowedChildren?: string[];
}): EmberComponentImplementation<Schema, Props> {
  const { component, tagName, ...api } = options;
  return {
    ...api,
    tagName: tagName ?? computeTagName(options.name),
    // One class per entry: `customElements` refuses to define a class twice.
    element: class extends EmberHost {},
    component,
  };
}

export interface ExtendBasicCatalogOptions {
  /** Which basic catalog to extend. Defaults to `'1.0'`. */
  version?: '1.0' | 'v0.9';
  /** Extra functions to add beside the basic catalog's. */
  functions?: FunctionImplementation[];
  /**
   * Include the basic catalog's components. Defaults to true; pass false for
   * a catalog made only of `components`.
   */
  includeBasic?: boolean;
}

/**
 * Builds a catalog from the basic catalog plus custom components (Glimmer
 * entries from `defineEmberComponent`, or any `WebComponentImplementation`).
 * Pass the result to `new A2uiSession({ catalogs: [...] })` and use its `id`
 * as `createSurface.catalogId`.
 */
export function extendBasicCatalog(
  id: string,
  components: ComponentApi[],
  options: ExtendBasicCatalogOptions = {},
): Catalog<ComponentApi, FunctionImplementation> {
  const base = options.version === 'v0.9' ? basicCatalogV09 : basicCatalogV1;
  const includeBasic = options.includeBasic ?? true;
  const merged = new Map<string, ComponentApi>();
  if (includeBasic) {
    for (const [name, impl] of base.components) merged.set(name, impl);
  }
  for (const impl of components) merged.set(impl.name, impl);
  const functions: FunctionImplementation[] = [
    ...(includeBasic ? base.functions.values() : []),
    ...(options.functions ?? []),
  ];
  return new Catalog<ComponentApi, FunctionImplementation>(
    id,
    base.protocolVersion,
    [...merged.values()],
    functions,
    { themeSchema: base.themeSchema },
  );
}

export type { FunctionApi };
