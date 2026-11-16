import Component from '@glimmer/component';
import { on } from '@ember/modifier';
import type { TOC } from '@ember/component/template-only';
import { module, test } from 'qunit';
import { setupRenderingTest } from 'test-app/tests/helpers';
import { render, click, waitUntil, settled } from '@ember/test-helpers';
import {
  A2uiNode,
  A2uiSession,
  A2uiSurfaces,
  ChildListSchema,
  DynamicStringSchema,
  defineEmberComponent,
  extendBasicCatalog,
  z,
  type EmberComponentSignature,
} from 'ember-a2ui';

const CATALOG_ID = 'https://example.com/catalogs/test/v1/catalog.json';

interface StatCardProps {
  label: string;
  value: string;
  setValue: (v: string) => void;
}

class StatCardComponent extends Component<
  EmberComponentSignature<StatCardProps>
> {
  reset = () => {
    this.args.props.setValue('reset!');
  };

  <template>
    <div class="stat-card" data-test-stat-card>
      <span data-test-label>{{@props.label}}</span>:
      <span data-test-value>{{@props.value}}</span>
      <button
        type="button"
        data-test-reset
        {{on "click" this.reset}}
      >reset</button>
    </div>
  </template>
}

interface PanelProps {
  children: unknown[];
}

const PanelComponent: TOC<EmberComponentSignature<PanelProps>> = <template>
  <div class="panel" data-test-panel>
    {{#each @props.children as |child|}}
      {{! @glint-expect-error children are ComponentNodes }}
      <A2uiNode @node={{child}} />
    {{/each}}
  </div>
</template>;

const StatCard = defineEmberComponent<z.ZodTypeAny, StatCardProps>({
  name: 'StatCard',
  schema: z.object({ label: DynamicStringSchema, value: DynamicStringSchema }),
  component: StatCardComponent,
});

const Panel = defineEmberComponent<z.ZodTypeAny, PanelProps>({
  name: 'Panel',
  schema: z.object({ children: ChildListSchema }),
  component: PanelComponent,
});

const messages = [
  {
    version: '1.0',
    createSurface: { surfaceId: 's1', catalogId: CATALOG_ID },
  },
  {
    version: '1.0',
    updateComponents: {
      surfaceId: 's1',
      components: [
        { id: 'root', component: 'Column', children: ['title', 'panel'] },
        {
          id: 'title',
          component: 'Text',
          text: 'Hello custom',
          variant: 'body',
        },
        { id: 'panel', component: 'Panel', children: ['stat', 'after'] },
        {
          id: 'stat',
          component: 'StatCard',
          label: 'Revenue',
          value: { '@path': '/revenue' },
        },
        { id: 'after', component: 'Text', text: 'Inside panel' },
      ],
    },
  },
  {
    version: '1.0',
    updateDataModel: { surfaceId: 's1', path: '/revenue', value: '$42' },
  },
];

module('Integration | a2ui custom Glimmer components', function (hooks) {
  setupRenderingTest(hooks);

  test('Glimmer component inside a basic Column receives props and bindings', async function (assert) {
    const catalog = extendBasicCatalog(CATALOG_ID, [StatCard, Panel]);
    const session = new A2uiSession({ catalogs: [catalog] });

    await render(<template><A2uiSurfaces @session={{session}} /></template>);
    session.processMessages(messages);
    await settled();
    await waitUntil(() => document.querySelector('[data-test-stat-card]'), {
      timeout: 3000,
    });

    assert.dom('[data-test-panel]').exists('Panel renders in the Column');
    assert.dom('[data-test-label]').hasText('Revenue');
    assert.dom('[data-test-value]').hasText('$42');
    assert
      .dom('[data-test-panel]')
      .includesText('Inside panel', 'Lit child rendered via A2uiNode');

    // live update of the data model re-renders the Glimmer component
    session.getSurface('s1')!.dataModel.set('/revenue', '$99');
    await settled();
    await waitUntil(
      () => document.querySelector('[data-test-value]')?.textContent === '$99',
      { timeout: 3000 },
    );
    assert.dom('[data-test-value]').hasText('$99');

    // the setter writes the data model
    await click('[data-test-reset]');
    assert.strictEqual(
      session.getSurface('s1')!.dataModel.get<string>('/revenue'),
      'reset!',
    );
    await waitUntil(
      () =>
        document.querySelector('[data-test-value]')?.textContent === 'reset!',
      { timeout: 3000 },
    );
    assert.dom('[data-test-value]').hasText('reset!');

    // deleting the surface removes everything
    session.processMessages({
      version: '1.0',
      deleteSurface: { surfaceId: 's1' },
    });
    await settled();
    assert.dom('[data-test-stat-card]').doesNotExist();
    session.dispose();
  });
});
