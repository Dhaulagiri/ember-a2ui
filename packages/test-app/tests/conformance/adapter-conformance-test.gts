// Runs A2UI's framework adapter conformance suites against ember-a2ui: the
// cases @a2ui/lit and @a2ui/react run, from conformance/core/adapter_conformance.yaml
// and conformance/core/accessibility.yaml. It follows @a2ui/lit's harness at the
// same commit (typescript/renderers/lit/src/tests/adapter_conformance.test.ts),
// with the surface rendered by `<A2uiSurface>` instead of `<a2ui-surface>`.
// `scripts/sync-conformance.py` updates the suites.
import type { TOC } from '@ember/component/template-only';
import { tracked } from '@glimmer/tracking';
import { module, test } from 'qunit';
import type Assert from 'qunit';
import { getRootElement, render, settled } from '@ember/test-helpers';
import {
  A2uiSession,
  A2uiSurface,
  defineEmberComponent,
  extendBasicCatalog,
  z,
  type ComponentNode,
  type EmberComponentSignature,
  type SurfaceModel,
} from 'ember-a2ui';
import { setupRenderingTest } from 'test-app/tests/helpers';
import { accessibilityCases, adapterCases, source } from './suites';

type QUnitAssert = typeof Assert.assert;

interface ExpectedAccessibilityNode {
  label?: string;
  description?: string;
  live?: string;
  hidden?: boolean;
  role?: string;
  checked?: boolean;
}

interface AccessibilityAssertions {
  accessibilityTree?: Record<string, ExpectedAccessibilityNode>;
  axeCore?: string[];
}

interface AccessibilityStep {
  messages: unknown[];
  assertions: AccessibilityAssertions;
}

interface AccessibilityTestCase {
  name: string;
  description?: string;
  messages?: unknown[];
  assertions?: AccessibilityAssertions;
  steps?: AccessibilityStep[];
}

interface ExpectedViewNode {
  id: string;
  type?: string;
  state?: string;
  text?: string;
  value?: unknown;
  badgeText?: string;
  isValid?: boolean;
  validationErrors?: string[];
  validationResults?: unknown[];
  children?: ExpectedViewNode[];
}

interface ExpectedAction {
  name: string;
  surfaceId: string;
  sourceComponentId: string;
  context?: Record<string, unknown>;
}

interface ExpectedError {
  code?: string;
  surfaceId?: string;
  message?: string;
}

interface AdapterStep {
  op:
    | 'process_messages'
    | 'user_input'
    | 'user_gesture'
    | 'programmatic_invoke'
    | 'unmount_surface';
  messages?: unknown[];
  targetNode?: string;
  inputValue?: unknown;
  userActivation?: boolean;
  expectViewTree?: ExpectedViewNode;
  expectDataModel?: Record<string, unknown>;
  expectSameViewIdentity?: string[];
  expectActions?: ExpectedAction[];
  expectErrors?: ExpectedError[];
  expectAccessibilityTree?: Record<string, ExpectedAccessibilityNode>;
  expectActiveSubscriptions?: number;
}

interface SecondaryCatalogSpec {
  catalogId: string;
  components: Record<string, unknown>;
}

interface AdapterTestCase {
  name: string;
  description?: string;
  catalogs?: SecondaryCatalogSpec[];
  steps: AdapterStep[];
}

type RecordedError = { code: string; message: string; surfaceId: string };

/**
 * Cases that ember-a2ui doesn't pass yet, by name, each with the reason. A
 * listed case runs as a todo, which must still fail, so a fix shows up as a
 * failure until its entry goes. Empty: every case passes at this commit.
 */
const KNOWN_GAPS: Record<string, string> = {};

/* The catalogs: the v1.0 basic catalog plus the suite's test function */

const BASIC_CATALOG_ID =
  'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json';

// The function local `functionCall` cases call.
const incrementCounter = {
  name: 'incrementCounter',
  returnType: 'void',
  schema: z.object({ path: z.string(), step: z.number() }),
  execute: (
    args: { path: string; step: number },
    context: {
      dataModel: {
        get(path: string): unknown;
        set(path: string, value: unknown): void;
      };
    },
  ) => {
    const current = Number(context.dataModel.get(args.path) ?? 0);
    context.dataModel.set(args.path, current + args.step);
  },
};

// A secondary catalog's components are drawn by a Glimmer component, which
// covers ember-a2ui's own hosting of custom catalog entries.
const Badge: TOC<EmberComponentSignature<{ badgeText?: string }>> = <template>
  <span class="a2ui-custom-badge">{{@props.badgeText}}</span>
</template>;

function buildCatalogs(testCase?: AdapterTestCase) {
  return [
    extendBasicCatalog(BASIC_CATALOG_ID, [], {
      functions: [incrementCounter],
    }),
    ...(testCase?.catalogs ?? []).map((spec) =>
      extendBasicCatalog(
        spec.catalogId,
        Object.keys(spec.components).map((name) =>
          defineEmberComponent({
            name,
            schema: z.object({ badgeText: z.string().optional() }),
            component: Badge,
          }),
        ),
        { includeBasic: false },
      ),
    ),
  ];
}

/* Reading the rendered view */

type A2uiElement = HTMLElement & {
  node?: ComponentNode;
  context?: {
    componentModel: { id: string; properties: Record<string, unknown> };
    dataContext: {
      path: string;
      resolveAction(
        action: unknown,
        options: { userActivation: boolean },
      ): void;
    };
  };
};

function allElements(container: Element): A2uiElement[] {
  return Array.from(container.querySelectorAll<A2uiElement>('*'));
}

function findByComponentId(
  container: Element,
  componentId: string,
): A2uiElement | undefined {
  return allElements(container).find(
    (el) => el.context?.componentModel.id === componentId,
  );
}

function findForNode(
  container: Element,
  target: ComponentNode,
): A2uiElement | undefined {
  return allElements(container).find(
    (el) =>
      el.node === target ||
      (el.context?.componentModel.id === target.componentId &&
        el.context.dataContext.path === target.dataPath),
  );
}

// A node's props are a signal; web_core's default is a Preact signal.
function propsOf(node: ComponentNode): Record<string, unknown> {
  return (node.props as unknown as { value: Record<string, unknown> }).value;
}

function isNode(value: unknown): value is ComponentNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    'componentId' in value &&
    'props' in value
  );
}

// A ResolvedBinding (or WritableBinding) holds a bound prop's value.
function unwrap(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return value;
  }
  const keys = Object.keys(value);
  return keys.includes('value') &&
    keys.every((key) => ['value', 'set', 'path'].includes(key))
    ? (value as { value: unknown }).value
    : value;
}

function childrenOf(node: ComponentNode): ComponentNode[] {
  const props = propsOf(node);
  if (Array.isArray(props['children'])) {
    return props['children'].filter(isNode);
  }
  return isNode(props['child']) ? [props['child']] : [];
}

function rootNode(container: Element): ComponentNode | undefined {
  return findByComponentId(container, 'root')?.node;
}

function resolveIdentity(container: Element, path: string) {
  if (path === 'root') {
    return findByComponentId(container, 'root');
  }
  const match = /^root\/children\/(\d+)$/.exec(path);
  const root = rootNode(container);
  if (match && root) {
    const child = childrenOf(root)[Number(match[1])];
    return child ? findForNode(container, child) : undefined;
  }
  return findByComponentId(container, path);
}

function snapshotIdentities(container: Element) {
  const map = new Map<string, HTMLElement>();
  const root = rootNode(container);
  if (!root) {
    return map;
  }
  const rootEl = resolveIdentity(container, 'root');
  if (rootEl) {
    map.set('root', rootEl);
  }
  childrenOf(root).forEach((child, index) => {
    const el = findForNode(container, child);
    if (el) {
      map.set(`root/children/${index}`, el);
    }
  });
  return map;
}

// Lit elements finish rendering asynchronously, after Ember settles.
async function settle(container: Element) {
  for (let pass = 0; pass < 3; pass++) {
    await settled();
    for (const el of [container, ...allElements(container)]) {
      const lit = el as unknown as { updateComplete?: Promise<boolean> };
      if (lit.updateComplete) {
        await lit.updateComplete;
      }
    }
  }
}

/* Assertions */

function assertViewTree(
  assert: QUnitAssert,
  container: Element,
  actual: ComponentNode,
  expected: ExpectedViewNode,
) {
  const at = `"${expected.id}"`;
  assert.strictEqual(actual.componentId, expected.id, `${at} id`);
  if (expected.type !== undefined) {
    assert.strictEqual(actual.type, expected.type, `${at} type`);
  }
  if (expected.state !== undefined) {
    assert.strictEqual(actual.state, expected.state, `${at} state`);
  }
  if (actual.state === 'resolved') {
    assert.ok(findForNode(container, actual), `${at} is mounted`);
  }
  const props = propsOf(actual);
  if (expected.text !== undefined) {
    assert.strictEqual(unwrap(props['text']), expected.text, `${at} text`);
    assert.ok(
      findForNode(container, actual)?.textContent?.includes(expected.text),
      `${at} shows its text`,
    );
  }
  if (expected.value !== undefined) {
    assert.deepEqual(unwrap(props['value']), expected.value, `${at} value`);
  }
  if (expected.badgeText !== undefined) {
    assert.strictEqual(
      unwrap(props['badgeText']),
      expected.badgeText,
      `${at} badgeText`,
    );
    assert.ok(
      findForNode(container, actual)?.textContent?.includes(expected.badgeText),
      `${at} shows its badge`,
    );
  }
  if (expected.isValid !== undefined) {
    assert.strictEqual(props['isValid'], expected.isValid, `${at} isValid`);
    const field = findForNode(container, actual)?.querySelector(
      '.a2ui-textfield',
    );
    if (field) {
      assert.strictEqual(
        field.classList.contains('a2ui-invalid'),
        !expected.isValid,
        `${at} draws its validity`,
      );
    }
  }
  if (expected.validationErrors !== undefined) {
    assert.deepEqual(
      props['validationErrors'],
      expected.validationErrors,
      `${at} validationErrors`,
    );
  }
  if (expected.validationResults !== undefined) {
    assert.deepEqual(
      props['validationResults'],
      expected.validationResults,
      `${at} validationResults`,
    );
  }
  if (expected.children !== undefined) {
    const children = childrenOf(actual);
    assert.strictEqual(
      children.length,
      expected.children.length,
      `${at} child count`,
    );
    expected.children.forEach((child, index) => {
      if (children[index]) {
        assertViewTree(assert, container, children[index], child);
      }
    });
  }
}

function accessibleLabel(el: HTMLElement) {
  return (
    el.getAttribute('aria-label') ||
    el.querySelector('button')?.textContent?.trim() ||
    el.querySelector('label')?.textContent?.trim() ||
    el.textContent?.trim() ||
    undefined
  );
}

function semanticRole(el: HTMLElement) {
  const role = el.getAttribute('role');
  if (role) return role;
  if (el.querySelector('button')) return 'button';
  if (el.querySelector('input[type="checkbox"]')) return 'checkbox';
  if (el.querySelector('input[type="radio"]')) return 'radiogroup';
  if (
    el.querySelector(
      'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea',
    )
  ) {
    return 'textbox';
  }
  return undefined;
}

function assertAccessibility(
  assert: QUnitAssert,
  container: Element,
  componentId: string,
  expected: ExpectedAccessibilityNode,
) {
  const el = findByComponentId(container, componentId);
  const at = `"${componentId}"`;
  assert.ok(el, `${at} is mounted`);
  if (!el) return;
  if (expected.label !== undefined) {
    assert.strictEqual(accessibleLabel(el), expected.label, `${at} label`);
  }
  if (expected.description !== undefined) {
    assert.strictEqual(
      el.getAttribute('aria-description'),
      expected.description,
      `${at} description`,
    );
  }
  if (expected.live !== undefined) {
    assert.strictEqual(
      el.getAttribute('aria-live'),
      expected.live,
      `${at} live`,
    );
  }
  if (expected.hidden !== undefined) {
    assert.strictEqual(
      el.getAttribute('aria-hidden'),
      String(expected.hidden),
      `${at} hidden`,
    );
  }
  if (expected.role !== undefined) {
    assert.strictEqual(semanticRole(el), expected.role, `${at} role`);
  }
  if (expected.checked !== undefined) {
    const box = el.querySelector<HTMLInputElement>('input[type="checkbox"]');
    assert.strictEqual(box?.checked, expected.checked, `${at} checked`);
  }
}

// The attribute-level subset @a2ui/lit checks in place of axe-core.
function assertAxeRules(
  assert: QUnitAssert,
  container: Element,
  rules: string[],
) {
  if (rules.includes('button-name')) {
    for (const button of Array.from(container.querySelectorAll('button'))) {
      const host = button.closest('a2ui-basic-button');
      const name =
        button.getAttribute('aria-label') ||
        host?.getAttribute('aria-label') ||
        button.textContent?.trim();
      assert.ok(name, 'a rendered button has an accessible name');
    }
  }
  if (rules.includes('aria-valid-attr-value')) {
    for (const node of Array.from(container.querySelectorAll('[aria-live]'))) {
      const value = node.getAttribute('aria-live');
      assert.ok(
        value !== null && ['off', 'polite', 'assertive'].includes(value),
        `aria-live is valid: ${String(value)}`,
      );
    }
  }
}

function countSubscriptions(surface: SurfaceModel) {
  const model = surface as unknown as {
    componentsModel: {
      onCreated: { listeners: Set<unknown> };
      onDeleted: { listeners: Set<unknown> };
    };
    dataModel: { subscriptions: Map<string, Set<unknown>> };
  };
  return (
    model.componentsModel.onCreated.listeners.size +
    model.componentsModel.onDeleted.listeners.size +
    model.dataModel.subscriptions.size
  );
}

/* A mounted surface */

class Mount {
  @tracked surface: SurfaceModel | undefined;
}

class Session {
  mount = new Mount();
  actions: ExpectedAction[] = [];
  errors: RecordedError[] = [];
  priorIdentities = new Map<string, HTMLElement>();

  constructor(readonly session: A2uiSession) {}

  get surface() {
    return this.mount.surface;
  }

  /** Mounts the suite's surface once a message has created it. */
  async ensureMounted(container: Element, assert: QUnitAssert) {
    if (this.mount.surface) {
      return;
    }
    const surface =
      this.session.getSurface('adapter_surface') ??
      this.session.getSurface('a11y_surface');
    assert.ok(surface, 'the messages create the surface');
    if (!surface) return;
    surface.onAction.subscribe((action) => {
      this.actions.push({
        name: action.name,
        surfaceId: action.surfaceId,
        sourceComponentId: action.sourceComponentId,
        context: action.context,
      });
    });
    surface.onError.subscribe((error) => {
      this.errors.push({
        code: error.code,
        message: error.message,
        surfaceId: surface.id,
      });
    });
    this.mount.surface = surface;
    await settle(container);
  }
}

async function performStep(
  assert: QUnitAssert,
  container: Element,
  state: Session,
  step: AdapterStep,
) {
  if (step.op === 'process_messages') {
    if (state.surface) {
      state.session.processMessages(step.messages ?? []);
      return;
    }
    // Mount as soon as the surface exists, so later messages in the step
    // reach a mounted view, as they do in @a2ui/lit's harness.
    for (const message of step.messages ?? []) {
      state.session.processMessages([message]);
      if (
        typeof message === 'object' &&
        message &&
        'createSurface' in message
      ) {
        await state.ensureMounted(container, assert);
      }
    }
    return;
  }
  const host = step.targetNode
    ? findByComponentId(container, step.targetNode)
    : undefined;
  if (step.op === 'user_input') {
    const input = host?.querySelector<HTMLInputElement>('input, textarea');
    assert.ok(input, `"${step.targetNode}" has an input`);
    if (!input) return;
    input.value = typeof step.inputValue === 'string' ? step.inputValue : '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  if (step.op === 'user_gesture') {
    const target = host?.querySelector('button') ?? host;
    assert.ok(target, `"${step.targetNode}" can be clicked`);
    // A gesture can run openUrl; keep it from opening a window.
    const open = window.open.bind(window);
    window.open = () => null;
    try {
      target?.click();
    } finally {
      window.open = open;
    }
    return;
  }
  if (step.op === 'programmatic_invoke') {
    const action = host?.context?.componentModel.properties['action'];
    assert.ok(action && host?.context, `"${step.targetNode}" has an action`);
    host?.context?.dataContext.resolveAction(action, {
      userActivation: Boolean(step.userActivation),
    });
    return;
  }
  if (step.op === 'unmount_surface') {
    state.mount.surface = undefined;
  }
}

function verifyStep(
  assert: QUnitAssert,
  container: Element,
  state: Session,
  step: AdapterStep,
) {
  if (step.expectViewTree) {
    const root = rootNode(container);
    assert.ok(root, 'the root is mounted');
    if (root) {
      assertViewTree(assert, container, root, step.expectViewTree);
    }
  }
  const surface =
    state.surface ??
    state.session.getSurface('adapter_surface') ??
    state.session.getSurface('a11y_surface');
  if (step.expectDataModel) {
    assert.deepEqual(
      surface?.dataModel.get('/'),
      step.expectDataModel,
      'data model',
    );
  }
  for (const path of step.expectSameViewIdentity ?? []) {
    const before = state.priorIdentities.get(path);
    const after = resolveIdentity(container, path);
    assert.ok(before && after, `"${path}" has a view before and after`);
    assert.strictEqual(after, before, `"${path}" keeps its view`);
  }
  if (step.expectActions !== undefined) {
    assert.deepEqual(state.actions, step.expectActions, 'actions');
  }
  if (step.expectErrors !== undefined) {
    assert.strictEqual(
      state.errors.length,
      step.expectErrors.length,
      'error count',
    );
    step.expectErrors.forEach((expected, index) => {
      const actual = state.errors[index];
      if (!actual) return;
      if (expected.code !== undefined) {
        assert.strictEqual(actual.code, expected.code, 'error code');
      }
      if (expected.surfaceId !== undefined) {
        assert.strictEqual(
          actual.surfaceId,
          expected.surfaceId,
          'error surface',
        );
      }
      if (expected.message !== undefined) {
        assert.ok(
          actual.message.includes(expected.message),
          `error message has "${expected.message}"`,
        );
      }
    });
  }
  for (const [id, expected] of Object.entries(
    step.expectAccessibilityTree ?? {},
  )) {
    assertAccessibility(assert, container, id, expected);
  }
  if (step.expectActiveSubscriptions !== undefined && surface) {
    assert.strictEqual(
      countSubscriptions(surface),
      step.expectActiveSubscriptions,
      'active subscriptions',
    );
  }
}

/* The suites */

// A case on the known-gap list runs as `test.todo`, which passes while the
// case fails and fails once it passes, so a fix can't go unnoticed.
function testFor(name: string) {
  return KNOWN_GAPS[name] ? test.todo : test;
}

function title(testCase: { name: string; description?: string }) {
  const gap = KNOWN_GAPS[testCase.name];
  return gap
    ? `${testCase.name} (known gap: ${gap})`
    : `${testCase.name}: ${testCase.description ?? ''}`;
}

module(
  `Conformance | A2UI framework adapter (${source.repo}@${source.commit})`,
  function (hooks) {
    setupRenderingTest(hooks);

    module('core/accessibility.yaml', function () {
      for (const testCase of accessibilityCases as AccessibilityTestCase[]) {
        testFor(testCase.name)(title(testCase), async function (assert) {
          const session = new A2uiSession({ catalogs: buildCatalogs() });
          const state = new Session(session);
          const { mount: surfaceHost } = state;
          await render(
            <template>
              {{#if surfaceHost.surface}}
                <A2uiSurface @surface={{surfaceHost.surface}} />
              {{/if}}
            </template>,
          );
          const container = getRootElement();
          const steps = testCase.steps ?? [
            {
              messages: testCase.messages ?? [],
              assertions: testCase.assertions ?? {},
            },
          ];
          try {
            for (const step of steps) {
              session.processMessages(step.messages);
              await state.ensureMounted(container, assert);
              await settle(container);
              for (const [id, expected] of Object.entries(
                step.assertions.accessibilityTree ?? {},
              )) {
                assertAccessibility(assert, container, id, expected);
              }
              if (step.assertions.axeCore) {
                assertAxeRules(assert, container, step.assertions.axeCore);
              }
            }
          } finally {
            session.dispose();
          }
        });
      }
    });

    module('core/adapter_conformance.yaml', function () {
      for (const testCase of adapterCases as AdapterTestCase[]) {
        testFor(testCase.name)(title(testCase), async function (assert) {
          const session = new A2uiSession({
            catalogs: buildCatalogs(testCase),
          });
          const state = new Session(session);
          const { mount: surfaceHost } = state;
          await render(
            <template>
              {{#if surfaceHost.surface}}
                <A2uiSurface @surface={{surfaceHost.surface}} />
              {{/if}}
            </template>,
          );
          const container = getRootElement();
          try {
            for (const step of testCase.steps) {
              state.actions = [];
              state.errors = [];
              state.priorIdentities = snapshotIdentities(container);
              await performStep(assert, container, state, step);
              await settle(container);
              verifyStep(assert, container, state, step);
            }
          } finally {
            session.dispose();
          }
        });
      }
    });

    test('every known gap names a case in the suites', function (assert) {
      const names = new Set(
        [...adapterCases, ...accessibilityCases].map(
          (testCase) => (testCase as { name: string }).name,
        ),
      );
      for (const name of Object.keys(KNOWN_GAPS)) {
        assert.ok(names.has(name), `"${name}" is a case`);
      }
      assert.ok(names.size > 0, 'the suites have cases');
    });
  },
);
