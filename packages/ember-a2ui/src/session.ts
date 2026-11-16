import { tracked } from '@glimmer/tracking';
import {
  MessageProcessor,
  type ActionPayload,
  type Catalog,
  type ComponentApi,
  type SurfaceModel,
} from '@a2ui/web_core';
import {
  basicCatalog as basicCatalogV1,
  injectBasicCatalogStyles,
  setMarkdownRenderer,
} from '@a2ui/web_core/v1_0';
import { basicCatalog as basicCatalogV09 } from '@a2ui/web_core/v0_9/basic_catalog';
import { renderMarkdown } from '@a2ui/markdown-it';

/** The wire form of an action, ready to send to the agent. */
export interface ActionEnvelope {
  version: string;
  action: object;
}

export interface A2uiSessionOptions {
  /** Catalogs the processor accepts. Defaults to the v1.0 and v0.9 basic catalogs. */
  catalogs?: Catalog<ComponentApi>[];
  /**
   * Called when a user interaction dispatches an action. `envelope` is the
   * ready-to-send wire message: `catalogId` (renderer-local) is stripped and
   * `version` follows the surface's protocol version.
   */
  onAction?: (
    action: ActionPayload,
    envelope: ActionEnvelope,
  ) => void | Promise<void>;
  /**
   * Skip the one-time global setup (default stylesheet injection and the
   * markdown renderer). Defaults to false.
   */
  skipGlobalSetup?: boolean;
}

function wireVersion(surface: SurfaceModel | undefined): string {
  return /^v?0\.9/.test(surface?.protocolVersion ?? '') ? 'v0.9' : '1.0';
}

/**
 * Owns a `MessageProcessor` and exposes its surfaces as tracked state.
 *
 * Feed it messages from outside of a render (a transport handler, an awaited
 * task, an event handler); `surfaces` is replaced on create/delete so
 * Glimmer autotracking sees the change.
 */
export class A2uiSession {
  /** All live surfaces. The array is replaced (never mutated) on change. */
  @tracked surfaces: SurfaceModel[] = [];

  readonly processor: MessageProcessor;

  #subscriptions: { unsubscribe(): void }[] = [];
  #disposed = false;

  constructor(options: A2uiSessionOptions = {}) {
    const catalogs = options.catalogs ?? [basicCatalogV1, basicCatalogV09];

    if (!options.skipGlobalSetup) {
      injectBasicCatalogStyles();
      setMarkdownRenderer(renderMarkdown);
    }

    const onAction = options.onAction;
    this.processor = new MessageProcessor(
      catalogs,
      onAction
        ? (action: ActionPayload) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { catalogId, ...wire } = action;
            const surface = this.processor.getSurface(action.surfaceId);
            return onAction(action, {
              version: wireVersion(surface),
              action: wire,
            });
          }
        : undefined,
    );

    this.#subscriptions = [
      this.processor.onSurfaceCreated(() => this.#sync()),
      this.processor.onSurfaceDeleted(() => this.#sync()),
    ];
    this.#sync();
  }

  #sync(): void {
    if (this.#disposed) return;
    this.surfaces = [...this.processor.getSurfaces().values()];
  }

  /**
   * Processes one message, an array of messages, or a JSON string of either.
   * Call outside of a render.
   */
  processMessages(messages: unknown): void {
    const payload =
      typeof messages === 'string'
        ? (JSON.parse(messages) as unknown)
        : messages;
    this.processor.processMessages(payload as never);
  }

  getSurface(id: string): SurfaceModel | undefined {
    return this.processor.getSurface(id);
  }

  /** Metadata to piggyback on every request to the agent. */
  getClientMetadata(): {
    a2uiRendererCapabilities: unknown;
    a2uiRendererDataModel: unknown;
  } {
    return {
      a2uiRendererCapabilities: this.processor.getRendererCapabilities({
        versions: ['1.0'],
      }),
      a2uiRendererDataModel: this.processor.getRendererDataModel(),
    };
  }

  /** Unsubscribes and disposes the processor and all surfaces. Idempotent. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#subscriptions.forEach((s) => s.unsubscribe());
    this.#subscriptions = [];
    this.processor.dispose();
  }
}
