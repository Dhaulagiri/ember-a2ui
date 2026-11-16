import type { TOC } from '@ember/component/template-only';
import type { ComponentNode } from '@a2ui/web_core';
import a2uiElement from '../modifiers/a2ui-element.ts';

interface A2uiNodeSignature {
  Element: HTMLDivElement;
  Args: {
    /** The resolved node to render. Pending / unknown nodes render nothing. */
    node: ComponentNode | undefined;
  };
}

/**
 * Renders one resolved `ComponentNode` as its custom element. The wrapper is
 * `display: contents`, so it takes no layout space.
 */
const A2uiNode: TOC<A2uiNodeSignature> = <template>
  <div class="a2ui-node" ...attributes {{a2uiElement @node}}></div>
</template>;

export default A2uiNode;
