# ember-a2ui

An Ember (Glimmer) renderer for [A2UI](https://a2ui.org), the agent-to-UI
protocol, built on `@a2ui/web_core`. Experimental and unofficial: not affiliated
with Google or the A2UI project.

## Supported protocol versions

| A2UI version | Supported | Notes                                                                                                                                                                                                                     |
| ------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v0.8         | No        | Not supported. `@a2ui/web_core` can parse v0.8 envelopes, but this renderer ships no v0.8 catalog, so surfaces cannot be created.                                                                                         |
| v0.9         | Yes       | Default `basicCatalog` for v0.9 is registered.                                                                                                                                                                            |
| v0.9.1       | Yes       | `"version": "v0.9.1"` messages are accepted by `@a2ui/web_core` 0.15.0 and rendered with the v0.9 basic catalog (the surface reports protocol version `v0.9`). The bare form `"0.9.1"` is rejected by the core validator. |
| v1.0         | Yes       | Default `basicCatalog` for v1.0 is registered.                                                                                                                                                                            |

Messages must carry a `version` field (`"v0.9"`, `"v0.9.1"` or `"1.0"`). The
session registers the v1.0 and v0.9 basic catalogs by default; pass
`catalogs` to `A2uiSession` to change that. Actions sent back to the agent use
`"v0.9"` for v0.9-family surfaces and `"1.0"` otherwise.

## Supported components

All 18 components of the basic catalog (identical names in v1.0 and v0.9) are
rendered through `@a2ui/web_core`'s universal elements:

| Group      | Components                                                         |
| ---------- | ------------------------------------------------------------------ |
| Layout     | `Row`, `Column`, `List`, `Card`, `Divider`                         |
| Display    | `Text`, `Image`, `Icon`, `Video`, `AudioPlayer`                    |
| Input      | `TextField`, `CheckBox`, `ChoicePicker`, `Slider`, `DateTimeInput` |
| Action     | `Button`                                                           |
| Navigation | `Tabs`, `Modal`                                                    |

Data binding (`{ "@path": "/..." }`), two-way input bindings, client-side
functions and action dispatch are handled by `MessageProcessor`.

## Requirements

- Ember 5.12+ (tested with Ember 6.12 and 7.4)
- `@glimmer/component` ^2.1.1 (peer dependency)
- An Embroider + Vite app, or an app using `ember-auto-import` 2.x
- Node 20.19+ (CI runs Node 24)

## Install

```sh
pnpm add ember-a2ui
```

## Minimal example

```gts
// app/components/agent-chat.gts
import Component from "@glimmer/component";
import { A2uiSession, A2uiSurfaces } from "ember-a2ui";
import type { ActionPayload, ActionEnvelope } from "ember-a2ui";

export default class AgentChat extends Component {
  session = new A2uiSession({
    onAction: async (_action: ActionPayload, envelope: ActionEnvelope) => {
      const response = await fetch("/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...envelope,
          ...this.session.getClientMetadata(),
        }),
      });
      // The agent answers with A2UI messages (an array or a single message).
      this.session.processMessages(await response.json());
    },
  });

  willDestroy() {
    super.willDestroy();
    this.session.dispose();
  }

  <template><A2uiSurfaces @session={{this.session}} /></template>
}
```

Feed messages from anywhere outside a render (a transport handler, an event
handler, an awaited task):

```ts
session.processMessages([
  {
    version: "1.0",
    createSurface: {
      surfaceId: "s1",
      catalogId:
        "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
    },
  },
  {
    version: "1.0",
    updateComponents: {
      surfaceId: "s1",
      components: [
        { id: "root", component: "Text", text: "Hello from the agent" },
      ],
    },
  },
]);
```

`catalogId` must match the `id` of a catalog registered with the session; the
demo (`demo/app`) shows complete message streams.
`processMessages` also accepts a JSON string.

Use `<A2uiSurface @surface={{surface}} />` to render a single surface, or
`<A2uiSurfaces>` to render all of them. `session.surfaces` is tracked state.

## Sending actions back to the agent

When a user presses a `Button` (or otherwise dispatches an action), the session
calls `onAction(action, envelope)`:

- `action` is the raw `ActionPayload` from `@a2ui/web_core`.
- `envelope` is the wire message: `{ version, action }`, where `version` follows
  the surface's protocol version and the renderer-local `catalogId` is removed.

Send the envelope to your agent. Piggyback `session.getClientMetadata()` on every
request; it returns `{ a2uiRendererCapabilities, a2uiRendererDataModel }`, so
the agent knows which catalogs the client supports and sees the current data
model of surfaces that set `sendDataModel`.

## Custom Glimmer components

Add your own catalog entries rendered by Glimmer components:

```gts
import Component from "@glimmer/component";
import {
  A2uiSession,
  DynamicStringSchema,
  defineEmberComponent,
  extendBasicCatalog,
  z,
  type EmberComponentSignature,
} from "ember-a2ui";

interface StatCardProps {
  label: string;
  value: string;
  setValue: (v: string) => void;
}

class StatCardComponent extends Component<
  EmberComponentSignature<StatCardProps>
> {
  <template>
    <div class="stat-card">{{@props.label}}: {{@props.value}}</div>
  </template>
}

const StatCard = defineEmberComponent<z.ZodTypeAny, StatCardProps>({
  name: "StatCard",
  schema: z.object({ label: DynamicStringSchema, value: DynamicStringSchema }),
  component: StatCardComponent,
});

const CATALOG_ID = "https://example.com/catalogs/my-app/v1/catalog.json";
const catalog = extendBasicCatalog(CATALOG_ID, [StatCard]);
const session = new A2uiSession({ catalogs: [catalog] });
```

Use `CATALOG_ID` as `createSurface.catalogId`; agents can then emit
`{ "id": "x", "component": "StatCard", "label": "Revenue", "value": { "@path": "/revenue" } }`.
Components receive `@props` (resolved values; a bound prop `value` also arrives
with a `setValue` setter), `@bindings`, `@node` and `@buildChild`. Render child
nodes with `<A2uiNode @node={{child}} />`. `extendBasicCatalog` accepts
`{ version: 'v0.9', functions, includeBasic }` as a third argument. The
`ember-a2ui` package re-exports `z` and the v1.0 `Dynamic*Schema`, `ChildSchema`,
`ChildListSchema` and `ActionSchema` helpers.

## Limitations

- The `@accessibility` property is not applied to custom components hosted
  through `defineEmberComponent`; handle accessibility inside your component.
- The re-exported schema helpers (`DynamicStringSchema`, ...) are the v1.0
  flavour. For v0.9 custom schemas import from `@a2ui/web_core/v0_9`.
- There is no conformance test harness yet.
- No server-side rendering (the renderer relies on custom elements and the DOM).
- v0.8 is not supported.

## More

Source, demo (A2UI Explorer) and issue tracker:
<https://github.com/Dhaulagiri/ember-a2ui>

## License

Apache-2.0
