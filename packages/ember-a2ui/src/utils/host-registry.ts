import { tracked } from '@glimmer/tracking';
import type { ComponentNode, SurfaceModel } from '@a2ui/web_core';
import { writeOutsideRender } from './safe-write.ts';
import type { EmberHost } from './ember-host.ts';

/** A connected Ember host element and the node it currently holds. */
export interface HostEntry {
  /** Stable key for `{{#each}}`; survives node updates of the same host. */
  readonly id: string;
  readonly host: EmberHost;
  readonly node: ComponentNode;
}

let nextId = 0;

/**
 * The Ember hosts currently connected for one surface that another renderer
 * (a Lit `Column`, say) created. `A2uiSurface` portals the Glimmer content of
 * each entry into its host with `{{in-element}}`.
 */
export class HostRegistry {
  static readonly #registries = new WeakMap<SurfaceModel, HostRegistry>();

  /** The registry of `surface`; hosts find it through their node's context. */
  static forSurface(surface: SurfaceModel): HostRegistry {
    let registry = HostRegistry.#registries.get(surface);
    if (!registry) {
      registry = new HostRegistry();
      HostRegistry.#registries.set(surface, registry);
    }
    return registry;
  }

  /** Autotracked; replaced (never mutated) on change. */
  @tracked entries: readonly HostEntry[] = [];

  readonly #hosts = new Map<EmberHost, HostEntry>();

  add(host: EmberHost, node: ComponentNode): void {
    const current = this.#hosts.get(host);
    if (current?.node === node) return;
    this.#hosts.set(host, { id: current?.id ?? `h${nextId++}`, host, node });
    this.#publish();
  }

  delete(host: EmberHost): void {
    if (this.#hosts.delete(host)) this.#publish();
  }

  has(host: EmberHost): boolean {
    return this.#hosts.has(host);
  }

  #publish(): void {
    writeOutsideRender(() => {
      this.entries = [...this.#hosts.values()];
    });
  }
}
