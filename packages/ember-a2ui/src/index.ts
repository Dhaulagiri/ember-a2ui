export { default as A2uiSurface } from './components/a2ui-surface.gts';
export { default as A2uiSurfaces } from './components/a2ui-surfaces.gts';
export { default as A2uiNode } from './components/a2ui-node.gts';
export { default as a2uiElement } from './modifiers/a2ui-element.ts';
export { A2uiSession } from './session.ts';
export type { A2uiSessionOptions, ActionEnvelope } from './session.ts';
export { SignalCell } from './utils/signal-bridge.ts';
export type {
  ActionPayload,
  ComponentNode,
  SurfaceModel,
  Catalog,
} from '@a2ui/web_core';
export {
  defineEmberComponent,
  extendBasicCatalog,
  isEmberComponentImplementation,
} from './define-component.ts';
export type {
  EmberCatalogComponent,
  EmberComponentArgs,
  EmberComponentImplementation,
  EmberComponentSignature,
  ExtendBasicCatalogOptions,
} from './define-component.ts';
export { HostRegistry } from './utils/host-registry.ts';
export { EmberHost } from './utils/ember-host.ts';

// Schema building blocks (v1.0 flavour) so custom catalog entries do not need
// their own `zod` / `@a2ui/web_core` dependency. For v0.9 schemas import from
// `@a2ui/web_core/v0_9` directly.
export { z } from 'zod';
export {
  DynamicStringSchema,
  DynamicNumberSchema,
  DynamicBooleanSchema,
  DynamicStringListSchema,
  ChildSchema,
  ChildListSchema,
  ActionSchema,
} from '@a2ui/web_core/v1_0';
