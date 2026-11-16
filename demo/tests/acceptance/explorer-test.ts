import { module, test } from 'qunit';
import {
  click,
  fillIn,
  settled,
  triggerEvent,
  visit,
  waitUntil,
} from '@ember/test-helpers';
import { setupApplicationTest } from 'demo/tests/helpers';

/** Collect text from a root, descending into open shadow roots. */
function deepText(root: Element | ShadowRoot): string {
  let text = '';
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? '';
    } else if (node instanceof Element) {
      if (node.shadowRoot) text += deepText(node.shadowRoot);
      text += deepText(node);
    }
  }
  return text;
}

/** Every element matching `selector`, including inside open shadow roots. */
function deepAll<T extends Element>(
  root: Element | ShadowRoot,
  selector: string,
  out: T[] = [],
): T[] {
  for (const el of Array.from(root.querySelectorAll('*'))) {
    if (el.matches(selector)) out.push(el as T);
    if (el.shadowRoot) deepAll(el.shadowRoot, selector, out);
  }
  return out;
}

function preview(): Element {
  const el = document.querySelector('[data-test-preview]');
  if (!el) throw new Error('no preview');
  return el;
}

const previewText = () => deepText(preview());

function surfaceIds(): string[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('section[data-surface-id]'),
  ).map((s) => s.dataset['surfaceId'] ?? '');
}

async function typeInto(placeholder: string, value: string) {
  const input = deepAll<HTMLInputElement>(preview(), 'input').find(
    (i) => i.placeholder === placeholder,
  );
  if (!input) throw new Error(`no input with placeholder ${placeholder}`);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await settled();
}

async function clickSurfaceButton(label: string) {
  const button = deepAll<HTMLButtonElement>(preview(), 'button').find((b) =>
    b.textContent?.includes(label),
  );
  if (!button) throw new Error(`no button labelled ${label}`);
  button.click();
  await settled();
}

module('Acceptance | explorer', function (hooks) {
  setupApplicationTest(hooks);

  test('selecting a sample renders it', async function (assert) {
    await visit('/');
    assert.dom('[data-test-sample]').exists({ count: 13 });

    await click('[data-test-sample="scaffold-simple-login-form"]');
    assert.dom('[data-test-sample-title]').hasText('Simple Login Form');

    await waitUntil(() => previewText().includes('Sign In'), { timeout: 3000 });
    assert.ok(previewText().includes('Login'), 'renders the form title');
    assert.ok(previewText().includes('Sign In'), 'renders the button label');
    assert.dom('[data-test-prompt]').hasText('Sign me in.');

    await click('[data-test-tab="edit"]');
    assert.dom('[data-test-editor]').hasValue(/createSurface/);
  });

  test('the transport scrubs and steps through the stream', async function (assert) {
    await visit('/');
    await click('[data-test-sample="cabin-booking"]');
    await waitUntil(() => previewText().includes('Reserve'));
    assert.dom('[data-test-progress]').hasText('4 / 4');
    assert.dom('[data-test-wire-entry]').exists({ count: 4 });
    assert.dom('.wire-entry.is-pending').doesNotExist();

    await fillIn('[data-test-scrubber]', '2');
    await triggerEvent('[data-test-scrubber]', 'input');
    assert.dom('[data-test-progress]').hasText('2 / 4');
    assert.dom('.wire-entry.is-pending').exists({ count: 2 });
    assert.ok(previewText().includes('Pine Hollow Cabins'), 'outline shown');
    assert.notOk(previewText().includes('Reserve'), 'form not sent yet');

    await click('[data-test-step]');
    await click('[data-test-step]');
    assert.dom('[data-test-progress]').hasText('4 / 4');
    assert.ok(previewText().includes('Reserve'), 'form arrives');
  });

  test('the mock agent answers with a second surface and deletes it', async function (assert) {
    await visit('/');
    await click('[data-test-sample="cabin-booking"]');
    await waitUntil(() => previewText().includes('Reserve'));

    await typeInto('Ada Lovelace', 'Ada');
    await typeInto('ada@example.com', 'ada@example.com');
    await clickSurfaceButton('Reserve');
    await waitUntil(() => surfaceIds().includes('cabin-reservation'));

    assert.ok(previewText().includes('Reserved for Ada'), 'reply rendered');
    assert.ok(previewText().includes('$567.00'), 'functions evaluated');
    assert
      .dom('[data-test-wire-entry="action"]')
      .exists({ count: 1 }, 'the action is logged going up');

    await click('[data-test-tab="state"]');
    assert.dom('[data-test-data-model]').exists({ count: 2 });

    await clickSurfaceButton('Cancel reservation');
    await waitUntil(() => !surfaceIds().includes('cabin-reservation'));
    assert.deepEqual(surfaceIds(), ['cabin-search']);
    assert.ok(previewText().includes('cancelled'), 'status updated');
  });

  test('custom messages from the editor', async function (assert) {
    await visit('/');
    await click('[data-test-tab="edit"]');
    await fillIn(
      '[data-test-editor]',
      JSON.stringify([
        {
          version: '1.0',
          createSurface: {
            surfaceId: 'mine',
            catalogId:
              'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json',
          },
        },
        {
          version: '1.0',
          updateComponents: {
            surfaceId: 'mine',
            components: [{ id: 'root', component: 'Text', text: 'Hi there' }],
          },
        },
      ]),
    );
    await click('[data-test-apply]');
    assert.dom('[data-test-sample-title]').hasText('Custom messages');
    await waitUntil(() => previewText().includes('Hi there'));
    assert.dom('[data-test-sample][aria-current]').doesNotExist();

    await fillIn('[data-test-editor]', '{ nope');
    await click('[data-test-apply]');
    assert.dom('[data-test-editor-error]').includesText('Invalid JSON');
  });
});
