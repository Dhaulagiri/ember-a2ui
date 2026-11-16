# Porting brief: A2UI renderer for Ember (Glimmer, .gts) on `@a2ui/web_core@0.15.0`

Repo root `A2` = `.../scratchpad/a2ui` (read-only clone). React renderer = `a2ui/typescript/renderers/react`.
Verification artifacts (published tarballs, tsc import checks, headless Node run) are in `.../scratchpad/pack`, `.../packreact`, `.../verify`.

## 0. Headline findings (read first)

1. **The React renderer does NOT implement the 18 basic-catalog components in React.** The basic catalog is a set of Lit custom elements living in `@a2ui/web_core` ("universal" web components). React only (a) resolves the node tree, (b) creates the root custom element and hands it `.node`; the Lit elements then render their own children recursively. React-native rendering exists only for *custom* catalog entries (`createComponentImplementation`), which are wrapped in a generated host custom element (`a2ui-react-<name>`) and portaled into. README: "They are W3C Custom Elements, and the React renderer renders them as elements" (`react/README.md`, "Basic Catalog Components").
2. Therefore a **minimal Ember renderer is tiny**: `MessageProcessor` -> `NodeResolver` (per surface) -> signal->tracked bridge for `rootNode` -> a modifier that does `registerUniversalElement(impl); el = document.createElement(impl.tagName); el.node = node`. The Lit reference for exactly this is `a2ui/typescript/renderers/lit/src/surface/a2ui-surface.ts` (~100 lines). Everything else (host registry, portals, memo, binder wrappers) in the React package is only there to let *React components* live inside Lit parents; Ember needs it only if you want Ember-native custom catalog components (Section 6, Phase 2).
3. **Repo HEAD is ahead of published 0.15.0.** `react/package.json` says 0.15.0 and `web_core/package.json` says 0.15.0, but HEAD React source imports symbols that the published `@a2ui/web_core@0.15.0` does **not** export (verified with `tsc` against the npm tarball, see Section 1.3). The published `@a2ui/react@0.15.0` tarball (`packreact/x/package/chunk-H4D2JAR7.js`) is the *same architecture* (NodeResolver + web components + portals) but imports only paths that exist in 0.15.0: `@a2ui/web_core/v0_9`, `/v0_9/basic_catalog`, `/v0_9/universal`. **Use those published import paths (or `/v1_0`) as your canonical list.**
4. The published npm package has no `dist/`: `main`/`types`/exports point at `./src/**/*.js|.d.ts` (ESM, `"type":"module"`, `sideEffects:false`). Deps you must have resolvable in the Ember build: `lit ^3.3.3`, `@lit/context`, `@preact/signals-core ^1.14.2`, `zod ^3.25.76` (single instance!), `redos-detector`, `validate-color`, `zod-to-json-schema`.
5. A **Lit renderer also exists** (`@a2ui/lit`, `a2ui/typescript/renderers/lit`) and is the closest analog for a web-component-hosting framework; its `a2ui-surface` element can even be used directly from Ember (Section 3.4).
6. Proven end-to-end headless with the published tarball (Node, no DOM): `MessageProcessor([basicCatalog])` -> `processMessages` -> `NodeResolver.rootNode` -> TextField `value.set('alice')` -> data model `{"username":"alice"}` -> Button `action()` -> `onAction` payload received; same for the v0.9 catalog (`verify/run.mjs`, `verify/run09.mjs`).

---

## 1. Public API used by the React renderer (and verified against published 0.15.0)

### 1.1 Import paths (all exist in 0.15.0 `exports`)

`@a2ui/web_core` (root), `/v0_9`, `/v1_0`, `/universal`, `/v0_9/universal`, `/v0_9/basic_catalog`, `/catalogs/basic/v1`, `/catalog`, `/state`, `/processing`, `/resolution`, `/reactivity`, `/validation`, `/expressions`, `/errors`, `/events`, `/semver`, `/rpc`, `/adapters`, `/v0_8`, `/v0_8/basic_catalog` (list: `package.json` of the tarball).

Root `index.d.ts` re-exports catalog, state, processing, resolution, validation, reactivity, expressions, errors, events, markdown types, semver, `spec_versions`. **Root does NOT export `catalogs/basic/*` or `universal/*`.** `/v1_0` re-exports everything in root plus the v1 schemas, `catalogs/basic/v1/index` and `universal/index` (so the docs' single-import style `@a2ui/web_core/v1_0` works). `/v0_9` re-exports root-ish + `./basic_catalog/index` (basicCatalog v0.9, `setMarkdownRenderer`, `injectBasicCatalogStyles`).

### 1.2 Symbols used by React (HEAD source in `react/src/**`), with 0.15.0 status

From `@a2ui/web_core` (all OK in 0.15.0): types `A2uiMetadata, Catalog, ComponentApi, ComponentContext, ComponentNode, InferredComponentApiSchemaType, MarkdownRenderer, NodeProps, ResolveA2uiProps, Signal, SurfaceModel`; values `GenericBinder, NodeResolver, ResolvedBinding, isComponentNode, isWritable, effect, getValue, peekValue, setValue`.

From `@a2ui/web_core/universal`:

| symbol | in 0.15.0 `/universal`? | note |
|---|---|---|
| `registerUniversalElement(impl)`, `isWebComponentImplementation(x)`, types `A2uiWebComponentElement`, `WebComponentImplementation` | yes | also `A2uiLitElement, A2uiController, renderA2uiNode, sanitizeMediaUrl` |
| `setMarkdownRenderer`, `getMarkdownRenderer` | **NO from `/universal`** | exist in `/v0_9/basic_catalog`, `/catalogs/basic/v1`, `/v0_9`, `/v1_0` |
| `bindHostAccessibility`, `createAccessibilityTargets`, `AccessibilityTargets` | **NO** (HEAD only) | only needed for React-implemented hosts; basic Lit elements apply ARIA themselves in 0.15.0 (`universal/basic_catalog/components/basic-catalog-a2ui-lit-element.js`: aria-label/description/live/hidden) |
| `A2UI_ELEMENT_CONNECTED_EVENT`, `dispatchA2uiElementConnected` | **NO** (HEAD only) | not needed |

Also at HEAD only: `MessageProcessorOptions.unifiedOutbound`, `.maxAgentCallCacheEntries`. Published options: `version, adapterRegistry, validationConfig, outboundListener, errorHandler, reportErrorsOnly, defaultTimeoutMs`.

### 1.3 Verification method
`npm pack @a2ui/web_core@0.15.0`, extracted, `npm i` in a clean dir, `tsc --noEmit` on a file importing each symbol (`verify/t.ts`, `verify/t2.ts`). t.ts failed exactly on the 5 symbols marked NO above; t2.ts (imports from `/v0_9`, `/v0_9/basic_catalog`, `/v0_9/universal`, `/v1_0`, `/catalogs/basic/v1`) compiles clean.

### 1.4 Signatures that matter (from published `.d.ts`)

```ts
// reactivity/signals.d.ts  (default backend = @preact/signals-core, effects run SYNCHRONOUSLY on write)
interface Signal<T> { __signalBrand?: T; unsubscribe?: () => void }
function effect(fn: () => void | (() => void)): () => void   // returns dispose
function getValue<T>(s: Signal<T>): T      // subscribes active effect
function peekValue<T>(s: Signal<T>): T     // no subscription
function setValue<T>(s: Signal<T>, v: T): void
function signal<T>(v:T), computed<T>(fn), batchWrite(fn), isSignal(v)
function setSignalImplementation(impl: SignalImplementations): void   // pluggable backend (see 6.4)

// processing/message-processor.d.ts
class MessageProcessor<T extends ComponentApi = ComponentApi> {
  constructor(catalogs: Catalog<any>[], actionHandler?: ActionListener, options?: MessageProcessorOptions)
  readonly model: SurfaceGroupModel<T>          // .surfacesMap, .onSurfaceCreated, .onSurfaceDeleted, .onAction, .onError, .dispose()
  getSurfaces(): ReadonlyMap<string, SurfaceModel<T>>;  getSurface(id)
  onSurfaceCreated(h: (s: SurfaceModel<T>) => void): Subscription   // {unsubscribe()}
  onSurfaceDeleted(h: (id: string) => void): Subscription
  processMessages(payload: ProcessableMessagePayload, ctx?: ExecutionContext): void           // sync; throws on invalid unless errorHandler/reportErrorsOnly
  processMessagesAsync(payload, ctx?): Promise<RendererFunctionResponseMessage[]>             // used by docs for transport chunks
  processMessagesWithErrors(messages: unknown, ctx?): RendererErrorMessage[]
  getRendererCapabilities({versions?, includeInlineCatalogs?}): RendererCapabilities   // metadata a2uiRendererCapabilities
  getRendererDataModel(version?): Record<string, unknown> | undefined                 // metadata a2uiRendererDataModel
  callAgentFunction(surfaceId, call, opts?), rpc, dispose(), catalogs, resolvePath()
}
// payload may be: one message, an array, {messages: [...]}  (v0.8/v0.9/v1.0 shapes)

// state/surface-model.d.ts
class SurfaceModel<T, F> {
  id, defaultCatalog, availableCatalogs: ReadonlyMap, rootId ('root'), dataModel: DataModel, componentsModel: SurfaceComponentsModel,
  theme, sendDataModel, protocolVersion, metadata, metadataSignal: Signal,
  onAction: EventSource<ActionPayload>, onError: EventSource<A2uiErrorPayload>, onWarning, onMetadataChanged,
  dispatchAction(payload, sourceComponentId, metadata?): Promise<void>, dispatchError(e: A2uiErrorPayload), dispose()
}
type ActionPayload = { name; surfaceId; sourceComponentId; timestamp(ISO); context: Record<string,unknown>; catalogId?; userMessage?; metadata? }
type ActionListener = (a: ActionPayload) => void | Promise<void>

// resolution/node-resolver.d.ts
class NodeResolver<C extends ComponentApi> {
  constructor(surface: SurfaceModel<C>, catalog?: Catalog<C>)
  readonly rootNode: Signal<ComponentNode<C> | undefined>
  dispose(): void;  get disposed(); get activeNodeCount()
}
// resolution/component-node.d.ts
interface ComponentNode<C> {
  instanceId, id (unique per instance, e.g. 'a2ui-n2'), componentId, type, dataPath, impl: C|undefined, context: ComponentContext|undefined,
  state: 'resolved'|'pending'|'unknown-type'|'cyclic', props: Signal<NodeProps>, metadata: Signal<A2uiMetadata|undefined>,
  onDestroyed: EventSource<void>, disposed, isPlaceholder, addCleanup(fn), toJSON()
}
isComponentNode(v): v is ComponentNode
type NodeAction = (options?: {metadata?: A2uiMetadata}) => void | Promise<void>
// resolution/resolved-binding.d.ts
class ResolvedBinding<T> { value: T }   class WritableBinding<T> extends ResolvedBinding<T> { set(v:T):void; path:string }
isWritable(b): b is WritableBinding
// universal
interface WebComponentImplementation extends ComponentApi { readonly tagName: string; readonly element: CustomElementConstructor }
interface A2uiWebComponentElement extends HTMLElement { context?: ComponentContext; node?: ComponentNode }
registerUniversalElement(impl)  // customElements.define(tagName, element) if absent; no-op if same ctor; THROWS if tag taken by different ctor; SSR: console.error once
isWebComponentImplementation(x) // typeof tagName === 'string' && typeof element === 'function'
```

---

## 2. Data flow

### 2.1 Messages in
App/transport code owns a `MessageProcessor` (React demo: `react/a2ui_explorer/src/App.tsx` `createFreshProcessor`, ~line 232; docs `docs/site/src/content/docs/guides/client-integration.mdx` Steps 2-5). Feed decoded JSON: `processor.processMessages(json)` (sync) or `await processor.processMessagesAsync(json)` (docs). Version is detected **per message** from its `version` field (Section 4). Message kinds (concepts/messages.mdx): `createSurface`, `updateComponents`, `updateDataModel`, `deleteSurface`; v1.0 adds `callRendererFunction`, `agentFunctionResponse`.

### 2.2 Surface creation / lookup
`createSurface` -> processor builds a `SurfaceModel` (default catalog = catalog whose `id` equals `createSurface.catalogId` among those passed to the constructor; protocol/catalog version compatibility enforced), adds to `processor.model` and fires `onSurfaceCreated`. Lookup: `processor.getSurface(id)`, `processor.getSurfaces()`, `processor.model.surfacesMap`. UI list is kept in sync with `onSurfaceCreated`/`onSurfaceDeleted` (README Quick Start; docs "AgentSurfaces"). `deleteSurface` disposes it and fires `onSurfaceDeleted(id)`. The surface view (`A2uiSurface`) takes `{surface: SurfaceModel}` and nothing else.

### 2.3 Resolving the tree (what `A2uiSurface` does; `react/src/A2uiSurface.tsx`)
1. `prepareCatalogs(surface)` (React-only: converts React catalog entries into web-component form; **skip in Ember Phase 1**).
2. `resolver = new NodeResolver(surface, surface.defaultCatalog)` (Lit version: `new NodeResolver(surface)`; both fine).
3. Subscribe: `stopEffect = effect(() => { getValue(resolver.rootNode); onChange(); })`; snapshot = `peekValue(resolver.rootNode)`.
4. Teardown: `stopEffect(); resolver.dispose()` (REQUIRED: disposing cancels all data-model subscriptions; blueprint §7).
5. If `root` undefined (root not yet arrived) render nothing. If `root.isPlaceholder || !root.impl` (pending/unknown-type/cyclic) render nothing (resolver already reported `UNKNOWN_COMPONENT_TYPE`/`CYCLIC_REFERENCE` via `surface.onError`). Otherwise render `root`'s element.

`rootNode` is a signal: it changes when `root` is created/replaced/deleted. `node.props` is a signal of an object whose values are: literals, `ResolvedBinding`/`WritableBinding` (for dynamic values), child `ComponentNode`s (single child / arrays / `{children: ComponentNode[]}`), `NodeAction` closures (for `Action` props), plus normalized `isValid`/`validationErrors` for checkable components. Child nodes are materialised by the resolver, including template (`List`/`children: {componentId, path}`) expansion with per-item data scope (`node.dataPath`).

### 2.4 Rendering a node
`react/src/node-view.tsx` `ChildElement`/`NodeContent`, `web_component_node.tsx` `WebComponentNode`: for a web-component impl the DOM is simply `<tagName>` with `element.node = node` assigned (comment in source: "Before node: a host decides whether to register when it gets one"). The Lit element (A2uiLitElement) then: sets `this.context = node.context`, builds an `A2uiController`, which does `effect(() => { props = nodePropsToControllerProps(node, getValue(node.props)); host.requestUpdate(); })`, and renders its children via `renderA2uiNode(childNode)` (creates child element, sets `.node` and `.context`). So **child recursion for basic components never touches the host framework.** Unmount cleanup is automatic: the controller disposes in `disconnectedCallback`. (React additionally calls `disposeElementControllers` when `!element.isConnected` for HostRegistry cases.)

### 2.5 Reactivity: signals -> React
React uses `useSyncExternalStore(subscribe, getSnapshot)` everywhere (`use_sync_external_store.ts` is only a polyfill for React 17). Pattern (`node-view.tsx` `useSignalValue`):
```ts
subscribe = onChange => effect(() => { getValue(signal); onChange(); })   // returns disposer
getSnapshot = () => peekValue(signal)
```
`useNodeView(node, buildChild)` = `useSignalValue(node.props)` + converts props with `toViewProps` (each `ResolvedBinding` -> `key: value` plus `setKey` setter; `WritableBinding` -> `inner.set`, read-only -> no-op) + child index so `buildChild(token)` finds the child node. The legacy per-component path (`adapter.tsx` `createComponentImplementation`) instead builds `new GenericBinder(context, api.schema)`, `binder.subscribe(cb)`, `binder.snapshot`, `binder.dispose()`. Metadata (`node.metadata` signal) is subscribed lazily only if the view reads it.

### 2.6 Actions back to the agent
- A `Button` props contains `action: NodeAction`. Invoking it (`props.action()`) resolves `action.event.context`/`userMessage` bindings against the data model, then `surface.dispatchAction(...)` emits `ActionPayload` on `surface.onAction`, which `SurfaceGroupModel` bubbles to `processor.model.onAction`; the `actionHandler` constructor arg (2nd param) is subscribed to `model.onAction`.
- Callback shape: `(action: ActionPayload) => void | Promise<void>` where `ActionPayload = {name, surfaceId, sourceComponentId, timestamp, context, userMessage?, metadata?, catalogId? }`.
- Wire envelope to send (concepts/messages.mdx "action"): v1.0 `{"version":"1.0","action":{name,surfaceId,sourceComponentId,timestamp,context,userMessage?,metadata?}}`; v0.9 `{"version":"v0.9","action":{name,surfaceId,sourceComponentId,timestamp,context}}`. `catalogId` is renderer-local and **omitted from the wire** (conformance guide, `expectOutbound`). Docs: `(action) => void this.sendToAgent({version: '1.0', action})`.
- A `functionCall` action runs locally and dispatches nothing. Actions are user-activation-aware: invoke inside the DOM gesture handler synchronously (blueprint §3). The closure type takes `{metadata}` only, so **do not pass a DOM event**: `onClick={() => props.action()}` / `{{on "click" this.fire}}` with `fire = () => this.args.props.action?.()`.
- Piggyback metadata on every outgoing request: `processor.getRendererCapabilities({versions:['1.0']})` -> `a2uiRendererCapabilities`; `processor.getRendererDataModel()` -> `a2uiRendererDataModel` (only surfaces created with `sendDataModel: true`). Verified output: `{"version":"1.0","surfaces":{"<id>":{"username":"alice"}}}`.
- Errors: `surface.onError` (A2uiErrorPayload `{code, message, surfaceId?, ...}`), `processor.model.onError`, `MessageProcessorOptions.errorHandler` + `reportErrorsOnly`.

### 2.7 Two-way binding (data-model writes from inputs)
Props for a dynamic property bound to `{"@path": "/username"}` (v0.9: `{"path":...}`) arrive as `WritableBinding` (`.value` current value, `.set(v)` writes `surface.dataModel.set(path, v)`, which notifies every dependent signal synchronously). Lit `TextField`: `@input=${e => props.setValue?.(e.target.value)}` (controller converts bindings to `value` + `setValue`). Verified: `tfp.value.set('alice')` -> `surface.dataModel.get('/')` = `{username:'alice'}` and subscribed effect re-ran with `'alice'`. Literal-valued props get a no-op setter. Direct data writes also possible: `surface.dataModel.set(path, v)`, `.get(path)`, `.subscribe(path, cb)`, `.getSignal(path)`.

---

## 3. Basic catalog components: mechanism and reuse from Ember

### 3.1 Mechanism
**Universal Lit web components from web_core** (not React-native). Defined in `web_core/src/universal/basic_catalog/components/*.ts`; both versions' catalogs pair a shared element class with a version-specific schema via `toWebComponentImplementation(ElementClass, Api)` -> `{...api, tagName: Element.tagName, element}` (`universal/to_web_component_implementation.js`; `catalogs/basic/v1/components/index.js`, `v0_9/basic_catalog/components/index`). Elements render into **Light DOM** (`createRenderRoot(){return this}`), adopt scoped styles; on connect call `injectBasicCatalogStyles()` (default stylesheet via `document.adoptedStyleSheets`). Theme via CSS vars on `:root`/container (`--a2ui-color-primary`, `--a2ui-color-on-primary`, `--a2ui-color-background`, `--a2ui-color-surface`, `--a2ui-color-on-background`, `--a2ui-font-family-title`, `--a2ui-spacing-*`...), `.a2ui-dark`/`.a2ui-light` classes (docs client-integration "Customize Basic Catalog theme tokens"). v0.9 `createSurface.theme.primaryColor` is honoured per element (`context.theme.primaryColor`); v1.0 has no theme.

### 3.2 Reuse directly from Ember: yes. Exactly how
```ts
import {MessageProcessor, NodeResolver} from '@a2ui/web_core/v1_0';           // v1_0 re-exports root + universal + basic v1
import {basicCatalog as basicV1, setMarkdownRenderer, injectBasicCatalogStyles} from '@a2ui/web_core/v1_0';
import {basicCatalog as basicV09} from '@a2ui/web_core/v0_9/basic_catalog';
import {registerUniversalElement} from '@a2ui/web_core/universal';
```
- Registration function: `registerUniversalElement(node.impl)` per implementation just before first use (idempotent). Or eagerly: `for (const impl of basicV1.components.values()) registerUniversalElement(impl)` (and v0.9; note v0.9 and v1.0 share the same tagNames and element classes, so double registration is a no-op). Lit's own `renderNode` registers lazily too, so eager registration is optional.
- Element creation: `const el = document.createElement(impl.tagName) as A2uiWebComponentElement; el.node = node; el.context = node.context;` (Lit's `renderA2uiNode` directive sets `node` first then `context`; published React sets only `node`).
- Properties to set on the root element: `node` (preferred; carries `context`) and optionally `context`. Nothing else; children are created by the elements.
- Element names (static `tagName`, from `src/universal/basic_catalog/components/*.js`): Text `a2ui-basic-text`, Row `a2ui-basic-row`, Column `a2ui-basic-column`, Button `a2ui-basic-button`, TextField `a2ui-basic-textfield`; the rest: `a2ui-image`, `a2ui-icon`, `a2ui-video`, `a2ui-audioplayer`, `a2ui-list`, `a2ui-card`, `a2ui-tabs`, `a2ui-modal`, `a2ui-divider`, `a2ui-checkbox`, `a2ui-choicepicker`, `a2ui-slider`, `a2ui-datetimeinput`. (Do not hardcode; read `node.impl.tagName`.)
- Markdown: `Text` renders Markdown through a module-global slot: `setMarkdownRenderer((md, opts) => string | Promise<string>)` (returns HTML, injected with `unsafeHTML`). Without it, text shows raw with one `console.warn`. Use `@a2ui/markdown-it` (`renderMarkdown`, npm 0.2.2) or your own sanitizer. React wires this in a layout effect (`A2uiSurface.tsx`); in Ember call once at app/service init.
- SSR/FastBoot: `registerUniversalElement` logs and no-ops without `customElements`; render surfaces client-side only.

### 3.3 Components and props (generated from the published catalog JSON: `a2ui/specification/v0_9/catalogs/basic/catalog.json`, `a2ui/catalogs/basic/v1/catalog.json`; zod in `web_core/src/{v0_9/basic_catalog,catalogs/basic/v1}/components/basic_components.ts`)

Types: `DynamicString/Number/Boolean/StringList` = literal | binding (`{"@path": "/x"}` v1.0, `{"path":"/x"}` v0.9) | function call (`{"@call":"fn","args":{...}}`, v0.9 `{"call":...}`); `ChildList` = `string[]` | `{componentId, path}` template; `Child` = component id string; `Action` = `{event:{name, context?, userMessage?(v1.0)}}` | `{functionCall:{...}}`. All components also accept `id`, `component`, accessibility (`@accessibility` {label, description, live, hidden} in v1.0; `accessibility` in v0.9) and `@checks`/`checks` (inputs), `@metadata`, `@catalogId` (v1.0 envelope; see `specification/v1_0/json/common_types.json` `ComponentCommon`). v1.0 adds `weight` (number, flex-grow, direct children of Row/Column) to every component.

| Component | Props (default) | v0.9 vs v1.0 |
|---|---|---|
| Text | `text`: DynString (req); `variant` | v0.9 variant `h1..h5\|caption\|body`; v1.0 `caption\|body` only (headings via Markdown `## x`) |
| Image | `url` (req), `description`, `fit` (contain\|cover\|fill\|none\|scaleDown; fill), `variant` (icon\|avatar\|smallFeature\|mediumFeature\|largeFeature\|header; mediumFeature) | same |
| Icon | `name` (req): enum of 59 names (accountCircle, add, ... warning) \| `{svgPath: DynString}` \| binding | same |
| Video | `url` (req) | v1.0 adds `posterUrl` |
| AudioPlayer | `url` (req), `description` | same |
| Row | `children` (req, ChildList), `justify` (start; center\|end\|spaceAround\|spaceBetween\|spaceEvenly\|stretch), `align` (stretch; start\|center\|end) | same |
| Column | `children` (req), `justify` (start\|center\|end\|spaceBetween\|spaceAround\|spaceEvenly\|stretch), `align` (stretch) | same |
| List | `children` (req), `direction` (vertical\|horizontal), `align` | v0.9 also `listStyle` (ordered\|unordered\|none) |
| Card | `child` (req) | v0.9 type ComponentId, v1.0 Child |
| Tabs | `tabs` (req): `[{title: DynString, child}]` | same |
| Modal | `trigger` (req child), `content` (req child) | same |
| Divider | `axis` (horizontal\|vertical; horizontal) | same |
| Button | `child` (req), `action` (req, Action), `variant` (default\|primary\|borderless; default) | same. Disabled when `isValid === false` |
| TextField | `label` (DynString), `value` (DynString, two-way), `variant` (shortText\|longText\|number\|obscured; shortText), `checks` | v0.9: only `label` req, extra `validationRegexp`; v1.0: `label`+`value` req, adds `placeholder` |
| CheckBox | `label` (req), `value` (DynBoolean, req, two-way) | same |
| ChoicePicker | `label`, `variant` (mutuallyExclusive\|multipleSelection), `options` `[{label,value}]` (req), `value` DynStringList (req, two-way), `displayStyle` (checkbox\|chips), `filterable` (false) | same |
| Slider | `label`, `min` (0), `max` (req), `value` DynNumber (req, two-way) | v1.0 adds `steps` (integer) |
| DateTimeInput | `value` DynString (req, ISO, two-way), `enableDate`, `enableTime`, `min`, `max`, `label` | same |

Catalog functions (both): `required, regex, length, numeric, email, formatString, formatNumber, formatCurrency, formatDate, pluralize, openUrl, and, or, not`; v0.9 additionally arithmetic/comparison (`add, subtract, multiply, divide, equals, notEquals, greaterThan, lessThan, contains, startsWith, endsWith`). These are evaluated by core (`BASIC_FUNCTIONS` / `V09_SPEC_FUNCTIONS`), not by the renderer. `openUrl` is user-activation gated.

Catalog ids: v1.0 `https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json`; v0.9 `https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json`.

### 3.4 Alternative: use `@a2ui/lit`'s `<a2ui-surface>` verbatim
`a2ui/typescript/renderers/lit/src/surface/a2ui-surface.ts` defines `<a2ui-surface .surface=${surface}>` (Light DOM). From Ember: `import '@a2ui/lit'; <a2ui-surface {{set-property 'surface' @surface}} />`. Cheapest possible integration (zero reactivity bridging), but not a "mirror of React", gives no Ember-native extension story, and `@a2ui/lit@0.15.0` was not inspected against the published web_core (not requested). Mentioned as fallback/baseline for comparison tests.

---

## 4. Protocol versions and selection

- `@a2ui/react` README: "Renders A2UI v0.9, v0.9.1 and v1.0 surfaces from the same package"; legacy v0.8 only via separate entry `@a2ui/react/v0_8` (hooks/provider-based, deprecated). Blueprint §1: the adapter is version-independent because Core produces the same `ComponentNode` tree for all versions.
- Selection is **core-driven, per message**: `VersionAdapterFactory.resolveFromPayload` reads `item.version` (strings accepted/normalized: `'0.9' | 'v0.9' | 'v0.9.1' | '1.0' | 'v1.0'`; v0.8 detected by `beginRendering/surfaceUpdate/...`). `SUPPORTED_PROTOCOL_VERSIONS = {0.8, 0.9, 0.9.1, 1.0}` (`processing/adapters/base.js`). Optional `MessageProcessorOptions.version` sets a default envelope version (for error context / unversioned input).
- The surface's catalog must be version-compatible with the message version (`DEFAULT_CATALOG_COMPATIBILITY`: 0.9<->0.9.1, 1.0 only 1.0). Version-specific pieces are only: which `basicCatalog` you pass (`/catalogs/basic/v1` vs `/v0_9/basic_catalog`), message syntax, `@path` vs `path`, `@call` vs `call`, `@accessibility`/`@checks` vs plain.
- Both catalogs can be registered in one processor (verified: `new MessageProcessor([b1, b9])`); `createSurface.catalogId` picks the default catalog per surface.
- **Current default = v1.0** (README Quick Start and docs client-integration all use `version: '1.0'` + `@a2ui/web_core/catalogs/basic/v1`; the explorer demo lists both and defaults its selector to v0.9 only for UI ordering). Outbound wire version string should match the surface's protocol (`'1.0'` or `'v0.9'`); read `surface.protocolVersion` (type `string | undefined`, unnormalised).

---

## 5. Minimal working message sequences

### 5.1 v1.0 (current): layout + text + bound TextField + Button action
Source: `a2ui/catalogs/basic/v1/examples/scaffold-simple-login-form.json` (the `.messages` array). Verified headless against published 0.15.0.

```json
[
  {"version": "1.0",
   "createSurface": {"surfaceId": "gallery-simple-login-form",
     "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json", "sendDataModel": true}},
  {"version": "1.0",
   "updateComponents": {"surfaceId": "gallery-simple-login-form", "components": [
     {"id": "root", "component": "Column", "children": ["form_title","username_field","password_field","submit_button"],
      "justify": "start", "align": "stretch"},
     {"id": "form_title", "component": "Text", "text": "## Login"},
     {"id": "username_field", "component": "TextField", "label": "Username", "value": {"@path": "/username"}, "variant": "shortText"},
     {"id": "password_field", "component": "TextField", "label": "Password", "value": {"@path": "/password"}, "variant": "obscured"},
     {"id": "submit_button", "component": "Button", "child": "submit_label", "variant": "primary",
      "action": {"event": {"name": "login_submitted", "context": {"user": {"@path": "/username"}, "pass": {"@path": "/password"}}}}},
     {"id": "submit_label", "component": "Text", "text": "Sign In"}
   ]}}
]
```
Optional data seeding message (from `react/README.md` Quick Start): `{"version":"1.0","updateDataModel":{"surfaceId":"...","path":"/","value":{"username":"..."}}}`. Other tiny samples: `catalogs/basic/v1/examples/scaffold-interactive-button.json`, `scaffold-simple-text.json`, `scaffold-row-layout.json`, `scaffold-incremental.json`, `child-list-template.json`. The explorer loads exactly these (`react/a2ui_explorer/scripts/generate-examples.mjs` reads `specification/v0_9/catalogs/basic/examples` and `catalogs/basic/v1/examples`).

Resulting action (observed): `{"name":"login_submitted","surfaceId":"gallery-simple-login-form","sourceComponentId":"submit_button","timestamp":"<ISO>","context":{"user":"alice"}}` (unset `/password` is omitted).

### 5.2 v0.9 equivalent
Source: `a2ui/specification/v0_9/catalogs/basic/examples/scaffold-simple-login-form.json`. Differences only: `"version": "v0.9"`, catalogId `https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json`, bindings `{"path": "/username"}`, `Text` has `"variant": "h2"` and `"text":"Login"`. Use `basicCatalog` from `@a2ui/web_core/v0_9/basic_catalog`.

---

## 6. Recommended Ember architecture

### 6.1 File mapping (React -> Ember)

| React file (`react/src/`) | Role | Ember equivalent |
|---|---|---|
| (app code in README / explorer `App.tsx`) | create `MessageProcessor`, subscribe to surface create/delete, action callback | `app/services/a2ui.ts` (plain `Service`/class `A2uiSession`): owns processor, `@tracked surfaces`, `ingest(json)`, `onAction` -> your transport, markdown + style init |
| `A2uiSurface.tsx` | NodeResolver lifecycle + root subscription | `components/a2ui-surface.gts` (Glimmer class component) |
| `use_sync_external_store.ts`, `node-view.tsx#useSignalValue` | signal -> framework reactivity | `utils/a2ui/signal-bridge.ts` (`SignalCell`, 6.3) |
| `web_component_node.tsx`, `node-view.tsx#ChildElement` | render node as its custom element, assign `.node` | `modifiers/a2ui-element.ts` + `components/a2ui-node.gts` |
| `catalog/prepare_catalogs.ts`, `to_web_component.tsx`, `catalog/react_host_element.ts`, `host_registry.ts`, `node-view.tsx#HostedChildren/NodeContent`, `adapter.tsx` | let framework-native components live as web-component hosts | **Phase 2 only**: `utils/a2ui/ember-host.ts`, `utils/a2ui/host-registry.ts`, `components/a2ui-node-content.gts`, `to-web-component.ts` |
| `react_component_implementation.ts`, `adapter.tsx` factories | author API for custom components | `utils/a2ui/create-component-implementation.ts` (Phase 2) |
| `markdown-context.tsx`, `markdown_hosts.tsx` | Markdown plumbing | one-time `setMarkdownRenderer(renderMarkdown)` in service; optional Ember-component Markdown is Phase 2+ |
| `catalog/host_accessibility.ts` | ARIA for React hosts | not needed for Phase 1 (Lit elements do ARIA). Phase 2: apply `props['@accessibility'] ?? props.accessibility` yourself on the host/inner element |
| `index.ts`, `v0_9/index.ts` | entry points | `addon/index.ts` exporting `A2uiSurface`, service, `createComponentImplementation`; no per-version entries needed |
| `tests/*` (`adapter_conformance.test.tsx`, `e2e_scenarios.test.tsx`, `v1_0_surface.test.tsx`, `v0_9/*`) | | `tests/integration/*` + conformance harness (Section 7) |

### 6.2 Phase 1 (web-component-only) pseudo-code

```ts
// app/services/a2ui.ts
import Service from '@ember/service';
import {tracked} from '@glimmer/tracking';
import {registerDestructor} from '@ember/destroyable';
import {MessageProcessor, setMarkdownRenderer, injectBasicCatalogStyles, basicCatalog,
        type SurfaceModel, type ActionPayload} from '@a2ui/web_core/v1_0';
import {basicCatalog as basicV09} from '@a2ui/web_core/v0_9/basic_catalog';
import {renderMarkdown} from '@a2ui/markdown-it';

export default class A2uiService extends Service {
  @tracked surfaces: SurfaceModel[] = [];
  processor = new MessageProcessor([basicCatalog, basicV09], a => void this.send(a));
  constructor(owner) {
    super(owner);
    injectBasicCatalogStyles(); setMarkdownRenderer(renderMarkdown);
    const subs = [this.processor.onSurfaceCreated(() => this.sync()), this.processor.onSurfaceDeleted(() => this.sync())];
    registerDestructor(this, () => { subs.forEach(s => s.unsubscribe()); this.processor.dispose(); });
  }
  sync() { this.surfaces = [...this.processor.getSurfaces().values()]; }   // replace array: autotracking
  ingest(json: unknown) { this.processor.processMessages(json as never); }
  async send(action: ActionPayload) {
    const {catalogId, ...wire} = action;                       // catalogId is renderer-local
    const surface = this.processor.getSurface(action.surfaceId);
    const version = /^v?0\.9/.test(surface?.protocolVersion ?? '') ? 'v0.9' : '1.0';   // default to 1.0
    await fetch('/api/agent', {method: 'POST', body: JSON.stringify({
      message: {version, action: wire},
      metadata: {a2uiRendererCapabilities: this.processor.getRendererCapabilities({versions: ['1.0']}),
                 a2uiRendererDataModel: this.processor.getRendererDataModel()}})});
  }
}
```
(Normalise `surface.protocolVersion` yourself; `canonical` helpers exist in `@a2ui/web_core/semver` / `spec_versions` `SpecVersion` enum: `V0_9='v0.9'`, `V1_0='1.0'`.) Important: **call `ingest` outside a render** (e.g. in a transport event handler or `await`ed task) so effect-driven `@tracked` writes don't happen during render (Ember "backtracking" assertion).

```gts
// app/components/a2ui-surface.gts
import Component from '@glimmer/component';
import {registerDestructor} from '@ember/destroyable';
import {NodeResolver, type SurfaceModel} from '@a2ui/web_core/v1_0';
import {SignalCell} from '../utils/a2ui/signal-bridge';
import A2uiNode from './a2ui-node';

export default class A2uiSurface extends Component<{Args: {surface: SurfaceModel}}> {
  resolver = new NodeResolver(this.args.surface, this.args.surface.defaultCatalog);   // surface arg must be stable: key by surface.id in {{#each}}
  root = new SignalCell(this, this.resolver.rootNode);
  constructor(o, a) { super(o, a); registerDestructor(this, () => this.resolver.dispose()); }
  <template>
    {{#let this.root.value as |root|}}
      {{#if root}}{{#unless root.isPlaceholder}}<A2uiNode @node={{root}} />{{/unless}}{{/if}}
    {{/let}}
  </template>
}
```
Caller: `{{#each this.a2ui.surfaces key="id" as |s|}}<A2uiSurface @surface={{s}} />{{/each}}`.

```gts
// app/components/a2ui-node.gts  (display:contents wrapper; mirrors Lit's renderA2uiNode directive)
import a2uiElement from '../modifiers/a2ui-element';
<template><div class="a2ui-node" {{a2uiElement @node}}></div></template>   // CSS: .a2ui-node { display: contents }
```
```ts
// app/modifiers/a2ui-element.ts
import {modifier} from 'ember-modifier';
import {registerUniversalElement, type A2uiWebComponentElement} from '@a2ui/web_core/universal';
export default modifier((host: HTMLElement, [node]: [ComponentNode | undefined]) => {
  if (!node || node.isPlaceholder || node.disposed || !node.impl) { host.replaceChildren(); return; }
  const impl = node.impl as WebComponentImplementation;
  registerUniversalElement(impl);                                   // idempotent; throws on tag collision
  let el = host.firstElementChild as A2uiWebComponentElement | null;
  if (!el || el.localName !== impl.tagName) {                       // type change under same id => new element
    el = document.createElement(impl.tagName) as A2uiWebComponentElement;
    host.replaceChildren(el);
  }
  el.node = node; el.context = node.context;                        // node first, then context
  return () => {};                                                  // element's own disconnectedCallback disposes its controller
});
```
That is a complete renderer for the whole basic catalog (and any universal/Lit custom component) in both protocol versions.

### 6.3 Signal -> autotracking bridge

Semantics to preserve: `effect` runs synchronously once on creation (subscribe) and again on every change; React skips the first-call notification and reads via `peekValue`. Ember equivalent: one `@tracked` cell per subscribed signal, written from the effect, disposed with the owner.

```ts
// app/utils/a2ui/signal-bridge.ts
import {tracked} from '@glimmer/tracking';
import {registerDestructor} from '@ember/destroyable';
import {effect, getValue, peekValue, type Signal} from '@a2ui/web_core/v1_0';

export class SignalCell<T> {
  @tracked private _v: T;
  private stop: () => void;
  constructor(owner: object, sig: Signal<T>) {
    this._v = peekValue(sig);
    let first = true;
    this.stop = effect(() => {
      const v = getValue(sig);                 // subscribes the preact effect to the signal graph
      if (first) { first = false; return; }    // initial run: already seeded
      this._v = v;                             // dirties the tracked tag -> Glimmer re-renders consumers
    });
    registerDestructor(owner, () => this.stop());
  }
  get value(): T { return this._v; }           // consumed in templates/getters: autotracked
}
```
Rules / hazards:
- **Identity**: `node.props` emits a *new object* each change, so default tracked `===` dirtying is correct. `rootNode` emits node objects; a placeholder is replaced in place by a new node object (same `instanceId`), so key `{{#each}}` lists by `instanceId`.
- **Signal swap** (an arg whose `Signal` identity changes, e.g. a node view reused for another node): either force recreation (`{{#each (array @node) key="instanceId"}}`) or use `ember-resources`: `resource(({on}) => { const cell = ...; on.cleanup(stop); return () => cell.value })` keyed on `@node`.
- **Backtracking**: effects fire synchronously inside whatever code wrote the signal (`processMessages`, `binding.set`). If that is inside a render that already read the cell, Ember asserts. Writes from user events/transport are fine. Mitigation: `scheduleOnce('afterRender', ...)` / `await Promise.resolve()` before `ingest`, or make `SignalCell` set via `queueMicrotask` after the first run.
- **Leak safety**: always dispose (`registerDestructor` on the owning component/service). Each `effect` pins the signal graph (data-model subscriptions) until disposed.
- **Batching**: bursts (several `updateDataModel`s in one `processMessages`) cause several synchronous sets; Glimmer coalesces to one render per runloop turn, so no extra batching needed.
- **Alternative (global)**: `setSignalImplementation({signal, computed, effect, batchWrite, isSignal, getValue, setValue, peekValue})` lets you replace preact signals by an autotracking-native backend so `getValue(sig)` inside a template is autotracked with no bridge. It must be installed before any surface is created and must satisfy all 8 members of `SignalImplementations`; web_core's own Lit elements also go through it. Higher risk; keep as an optimisation, not the baseline.
- Do not read `getValue()` (tracked read) of a preact signal outside `effect`; use `peekValue` for snapshots.

### 6.4 Phase 2: Ember-native components for custom catalog entries (mirrors React `adapter.tsx` + host registry)

Needed only if you want authors to write catalog components as Glimmer components that can sit inside Lit parents (e.g. a `Column` containing your `StatCard`). Contract any custom entry must satisfy for a Lit parent: be a `WebComponentImplementation` (`tagName`, `element`, plus `ComponentApi` `name`/`schema`); the parent calls `document.createElement(tagName)` and assigns `.node`/`.context`. React's trick (`catalog/to_web_component.tsx`, `react_host_element.ts`): generate `tagName = a2ui-react-<name.toLowerCase()>` (suffix `-2`,... on duplicates) and an empty-ish host class `class extends ReactWcHost {}` (one class per tag; `customElements` refuses reuse). The host sets `style.display='contents'`; when created by a non-React parent, `connectedCallback`/`set node` registers `{host, node}` in a per-surface `HostRegistry` (WeakMap keyed by `SurfaceModel`), and a React `HostedChildren` portals `NodeContent` into the host; `disconnectedCallback` unregisters in a microtask (so re-parenting keeps state).

Ember translation:
```ts
class EmberHost extends HTMLElement implements A2uiWebComponentElement {
  context?; #node?; registry?: HostRegistry;
  connectedCallback() { this.style.display = 'contents'; this.register(); }
  disconnectedCallback() { queueMicrotask(() => { if (!this.isConnected) { this.registry?.delete(this); this.registry = undefined; } }); }
  set node(n) { this.#node = n; this.context = n?.context; this.register(); }  get node() { return this.#node; }
  register() { const n = this.#node; if (!this.isConnected || !n || isEmberRendered(this)) return;
               const surface = n.context!.dataContext.surface; (this.registry = HostRegistry.forSurface(surface)).add(this, n); } }
class HostRegistry { @tracked entries: {host, node}[] = []; add(...) { this.entries = [...]; } delete(...) {...} }   // replace array on change
```
```gts
// inside a2ui-surface.gts, after the root node:
{{#each this.registry.entries key="host" as |e|}}
  {{#in-element e.host insertBefore=null}}<A2uiNodeContent @node={{e.node}} />{{/in-element}}
{{/each}}
```
`A2uiNodeContent` = Glimmer shell: `const cell = new SignalCell(this, node.props)`; builds view props by the same conversion as `toViewProps` (`node-view.tsx`: `ResolvedBinding` -> `key` + `setKey`; `WritableBinding.set` else no-op; child `ComponentNode` -> render via `<A2uiNode @node=...>` wrapper which creates the child element via the same modifier; React's `{id, basePath}` token indirection exists only for legacy `buildChild(id)` APIs, so Ember can pass `ComponentNode`s directly) and yields to the author's component (`<Impl @props={{...}} @node={{@node}} @buildChild=... />`). Ember simplification vs React: no `HostOwner` nesting is required (React needs it to nest the React tree like the DOM so context/error boundaries work); Ember `in-element` content can live in one flat list per surface. Keep `isEmberRendered`: hosts that your own Glimmer template created (child of an Ember component) render content as slot children instead of portal; or simply always portal (simplest).

Custom catalog assembly (docs `authoring-universal-components.mdx` Step 3):
```ts
new Catalog('https://example.com/catalogs/x/v1/catalog.json', '1.0',
  [...basicCatalog.components.values(), myEntry], BASIC_FUNCTIONS)   // pass to MessageProcessor
```
For React the catalog entries are converted in place by `prepareCatalogs(surface)` before the resolver exists, **and again on `surface.componentsModel.onCreated`** (components can reference another catalog via `@catalogId`/`availableCatalogs`); replicate both calls.

Simplest Phase 2 alternative: write custom components as **universal Lit/vanilla custom elements** (`A2uiLitElement` + `this.controller.props`, `this.renderNode(child)`; docs `authoring-universal-components.mdx`), which then need zero Ember glue (just register in a catalog). Choose Phase 2 only for real Glimmer authoring.

### 6.5 Ember-specific checklist
- Build: Embroider/Vite must handle ESM packages with `.js` extension imports and `exports` subpaths; transpile `lit` and `@a2ui/web_core` as deps (they ship ES2022 JS; decorators are pre-compiled with `__decorate`). Ensure only one copy of `zod` and `lit` (custom elements are global; duplicate `lit` can cause `customElements.define` collisions).
- Global CSS: call `injectBasicCatalogStyles()` once; set `--a2ui-*` vars on the host app root. Wrapper `.a2ui-node{display:contents}`.
- Unknown/pending/cyclic nodes render nothing and take no layout space (blueprint §6; the wrapper uses `display:contents` and is empty).
- Testing: `@ember/test-helpers` + settled-ness: Lit updates are microtask-async; `await el.updateComplete` or `await settled()` plus `await Promise.resolve()`.
- Security: Markdown HTML is injected with `unsafeHTML`; sanitise (`@a2ui/markdown-it` disables raw HTML). Treat agent payloads as untrusted (README "Security"). `sanitizeMediaUrl` is exported from `/universal` for custom media components.
- Unmount: destroying `A2uiSurface` must dispose the `NodeResolver` (done via destructor). Surface deletion is signalled via `onSurfaceDeleted`; `model.dispose()` on service teardown.

---

## 7. Conformance: is a client renderer expected to ship a harness?

Sources: `a2ui/conformance/README.md`, `conformance/conformance_harness_implementation_guide.md` (sections "Framework adapter harness", "Golden-transcript harness", "Executed-case manifest"), `a2ui/blueprints/modules/a2ui_framework_adapter.blueprint.md` §8.
- A framework adapter is the third SDK tier; the repo's renderers (Lit, React, Angular, Flutter, SwiftUI) each carry a harness. It is **expected for in-repo adapters and for claiming feature IDs `F-RND-*` in `conformance/features.yaml`**, not required to *use* A2UI. Core-protocol conformance comes for free through `@a2ui/web_core` (headless harness at `typescript/core/web_core/tests/conformance/`).
- Adapter harness runs two YAML suites: `core/adapter_conformance.yaml` (13 v1.0 `render_surface` cases) and `core/accessibility.yaml` (6 `accessibility_check` cases), plus optional e2e transcripts (`e2e/*.yaml`, renderer half) and a skip list (`SUPPORTED_PROTOCOL_VERSIONS`, `SKIP_TEST_NAMES`; `UNSUPPORTED` entries with reason, e.g. axe-core "no layout engine" for DOM shims). With `A2UI_CONFORMANCE_MANIFEST_DIR` set each executed/skipped case writes a JSONL record (`executed_case_manifest.schema.json`).
- Minimum needed to implement a harness for an Ember renderer:
  1. YAML loader (js-yaml) for the two suites + `catalogs/basic/v1/catalog.json`; register basic catalog (+ test `incrementCounter` function, stubbed `openUrl`; inline custom catalogs such as `StatusBadge` for `multi_catalog_mixed_surface_rendering`).
  2. `mountSurface(messages)` -> build a `MessageProcessor`, render `<A2uiSurface>` (in an Ember integration test), wait for settle (see 6.5).
  3. Step ops (5): `process_messages`, `user_input` (type into TextField/CheckBox/ChoicePicker/Slider/DateTimeInput/Tabs), `user_gesture` (click, with user activation), `programmatic_invoke` (activation=false), `unmount_surface`.
  4. Assertions: `expectViewTree` (walk the DOM / node tree: id, type, state, text/value/url, isValid, validationErrors, children order), `expectDataModel`, `expectActions`, `expectErrors`, `expectAccessibilityTree`, `expectOutbound` (validate wire envelopes against `specification/v1_0/json/renderer_to_agent.json`), identity/disposal (`expectSameViewIdentity`, `expectDisposedNodes`, `expectSurfaceRemoved`, `expectActiveSubscriptions` = 0 after unmount), `expectThemeAbsent`.
  Worked references to copy: `typescript/renderers/lit/src/tests/adapter_conformance.test.ts` (215 lines) + `adapter_harness.ts` (DOM-based, closest to an Ember web-component renderer) and `typescript/renderers/react/tests/adapter_conformance.test.tsx` + `adapter_harness.tsx`. React's package.json lists the YAML inputs under `wireit.test:unit.files`.
- Required behavioural test list (blueprint §8): tree hierarchy, single-message surface, progressive arrival (placeholder upgrade without remount), `List` repeaters with `@index`, two-way binding, action execution (event vs functionCall), user activation, multiple catalogs, validation results (error disables control, warning doesn't), accessibility attributes, no theme on v1.0, fallback states, teardown (all subscriptions released).
- For a Phase-1 renderer most of these exercise `web_core` + Lit elements, so only the surface lifecycle, error/cleanup and mixed-catalog/custom-entry cases test your own code.

## 8. Quick reference: files to read in the repo
- `a2ui/typescript/renderers/react/src/{A2uiSurface.tsx, node-view.tsx, web_component_node.tsx, adapter.tsx, host_registry.ts, catalog/*.ts*, react_component_implementation.ts}`
- `a2ui/typescript/renderers/lit/src/surface/a2ui-surface.ts` (minimal reference)
- `a2ui/typescript/core/web_core/src/{processing/message-processor.ts, state/surface-model.ts, state/surface-group-model.ts, resolution/{node-resolver,component-node,resolved-binding,generic-binder}.ts, reactivity/signals.ts, universal/*, catalogs/basic/v1/*, v0_9/basic_catalog/*}`
- `a2ui/docs/site/src/content/docs/guides/{client-integration,authoring-universal-components}.mdx`, `concepts/{messages,data-binding,actions-and-functions}.mdx`
- `a2ui/blueprints/modules/a2ui_framework_adapter.blueprint.md` (normative adapter spec: Surface, NodeView, lifecycle, tests)
