import type {
  ComponentContext,
  ComponentNode,
  SurfaceModel,
} from '@a2ui/web_core';
import type { A2uiWebComponentElement } from '@a2ui/web_core/universal';
import { HostRegistry } from './host-registry.ts';

/**
 * The custom element that stands in the DOM for a node implemented as a
 * Glimmer component (for example `<a2ui-ember-statcard>`). It holds no
 * implementation: when a Lit parent creates it and assigns `.node`, it
 * registers with its surface's `HostRegistry`, and the surface portals the
 * Glimmer content into it.
 */
export class EmberHost extends HTMLElement implements A2uiWebComponentElement {
  context?: ComponentContext;
  #node?: ComponentNode;
  #registry?: HostRegistry;

  connectedCallback(): void {
    this.style.display = 'contents';
    this.#register();
  }

  disconnectedCallback(): void {
    // Deferred, so re-parenting (a disconnect and a connect in the same task)
    // keeps the portal and the component's state.
    queueMicrotask(() => {
      if (!this.isConnected) {
        this.#registry?.delete(this);
        this.#registry = undefined;
      }
    });
  }

  set node(node: ComponentNode | undefined) {
    this.#node = node;
    this.context = node?.context;
    this.#register();
  }

  get node(): ComponentNode | undefined {
    return this.#node;
  }

  #register(): void {
    const node = this.#node;
    if (!this.isConnected || !node) return;
    const surface = node.context?.dataContext.surface as
      SurfaceModel | undefined;
    if (!surface) return;
    const registry = HostRegistry.forSurface(surface);
    // A node from another surface moves the host to that surface.
    if (this.#registry !== registry) this.#registry?.delete(this);
    this.#registry = registry;
    registry.add(this, node);
  }
}
