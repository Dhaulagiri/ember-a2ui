import Component from '@glimmer/component';
import type Owner from '@ember/owner';
import type { TOC } from '@ember/component/template-only';
import { registerDestructor } from '@ember/destroyable';
import { array } from '@ember/helper';
import {
  NodeResolver,
  type ComponentNode,
  type SurfaceModel,
} from '@a2ui/web_core';
import { SignalCell } from '../utils/signal-bridge.ts';
import A2uiNode from './a2ui-node.gts';

interface SurfaceViewSignature {
  Element: HTMLDivElement;
  Args: { surface: SurfaceModel };
}

/**
 * Owns the `NodeResolver` for one surface. Created per surface object (see
 * `A2uiSurface`), so the resolver never goes stale.
 */
class SurfaceView extends Component<SurfaceViewSignature> {
  resolver = new NodeResolver(
    this.args.surface,
    this.args.surface.defaultCatalog,
  );
  root = new SignalCell<ComponentNode | undefined>(
    this,
    this.resolver.rootNode,
  );

  constructor(owner: Owner, args: SurfaceViewSignature['Args']) {
    super(owner, args);
    // Disposing the resolver releases every data-model subscription.
    registerDestructor(this, () => this.resolver.dispose());
  }

  <template>
    <div class="a2ui-surface" data-surface-id={{@surface.id}} ...attributes>
      <A2uiNode @node={{this.root.value}} />
    </div>
  </template>
}

interface A2uiSurfaceSignature {
  Element: HTMLDivElement;
  Args: {
    /** The surface to render, from `A2uiSession#surfaces`. */
    surface: SurfaceModel;
  };
}

/**
 * Renders one A2UI surface. A new `@surface` object tears the old view down
 * and builds a fresh resolver.
 */
const A2uiSurface: TOC<A2uiSurfaceSignature> = <template>
  {{#each (array @surface) as |surface|}}
    <SurfaceView @surface={{surface}} ...attributes />
  {{/each}}
</template>;

export default A2uiSurface;
