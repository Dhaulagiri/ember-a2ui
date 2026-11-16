import type { TOC } from '@ember/component/template-only';
import type { A2uiSession } from '../session.ts';
import A2uiSurface from './a2ui-surface.gts';

interface A2uiSurfacesSignature {
  Element: HTMLDivElement;
  Args: {
    session: A2uiSession;
  };
}

/**
 * Renders every surface in the session, keyed by surface id.
 */
const A2uiSurfaces: TOC<A2uiSurfacesSignature> = <template>
  {{#each @session.surfaces key="id" as |surface|}}
    <section class="a2ui-surface-host" data-surface-id={{surface.id}}>
      <A2uiSurface @surface={{surface}} ...attributes />
    </section>
  {{/each}}
</template>;

export default A2uiSurfaces;
