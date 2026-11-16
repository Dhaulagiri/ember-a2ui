import { module, test } from 'qunit';
import { click, visit, waitUntil } from '@ember/test-helpers';
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

function previewText() {
  const preview = document.querySelector('[data-test-preview]');
  return preview ? deepText(preview) : '';
}

module('Acceptance | explorer', function (hooks) {
  setupApplicationTest(hooks);

  test('selecting a sample renders it', async function (assert) {
    await visit('/');
    assert.dom('[data-test-sample]').exists({ count: 11 });

    await click('[data-test-sample="scaffold-simple-login-form"]');
    assert.dom('[data-test-sample-title]').hasText('Simple Login Form');

    await waitUntil(() => previewText().includes('Sign In'), { timeout: 3000 });
    assert.ok(previewText().includes('Login'), 'renders the form title');
    assert.ok(previewText().includes('Sign In'), 'renders the button label');
    assert.dom('[data-test-editor]').hasValue(/createSurface/);
  });
});
