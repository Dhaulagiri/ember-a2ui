import { module, test } from 'qunit';
import { setupRenderingTest } from 'test-app/tests/helpers';
import { render, click, fillIn, waitUntil, settled } from '@ember/test-helpers';
import { A2uiSession, A2uiSurfaces, type ActionPayload } from 'ember-a2ui';
import { scaffoldSimpleLoginForm } from '../fixtures/scaffold-simple-login-form';

const SURFACE_ID = 'gallery-simple-login-form';

/** Lit updates are microtask-async: wait for something to appear. */
async function find<T extends Element>(selector: string): Promise<T> {
  await waitUntil(() => document.querySelector(selector), { timeout: 3000 });
  return document.querySelector(selector) as T;
}

module('Integration | a2ui surfaces', function (hooks) {
  setupRenderingTest(hooks);

  test('v1.0 login form renders, two-way binds and dispatches actions', async function (assert) {
    const actions: { action: ActionPayload; envelope: object }[] = [];
    const session = new A2uiSession({
      onAction: (action, envelope) => {
        actions.push({ action, envelope });
      },
    });

    await render(<template><A2uiSurfaces @session={{session}} /></template>);
    session.processMessages(scaffoldSimpleLoginForm);
    await settled();

    assert.strictEqual(session.surfaces.length, 1);
    assert
      .dom(`section.a2ui-surface-host[data-surface-id="${SURFACE_ID}"]`)
      .exists();

    // Text component (markdown "## Login")
    await waitUntil(() => document.querySelector('a2ui-basic-text'), {
      timeout: 3000,
    });
    await waitUntil(() => /Login/.test(document.body.textContent ?? ''), {
      timeout: 3000,
    });
    assert.dom('.a2ui-surface').includesText('Login');

    // TextField
    const input = await find<HTMLInputElement>(
      'a2ui-basic-textfield input, a2ui-basic-textfield textarea',
    );
    assert.ok(input, 'text field renders an input');

    await fillIn(input, 'alice');
    const surface = session.getSurface(SURFACE_ID)!;
    await waitUntil(
      () =>
        surface.dataModel.get<{ username?: string }>('/').username === 'alice',
      { timeout: 3000 },
    );
    assert.strictEqual(
      surface.dataModel.get<{ username?: string }>('/').username,
      'alice',
      'data model updated by typing',
    );
    assert.strictEqual(
      JSON.stringify(
        (
          session.getClientMetadata().a2uiRendererDataModel as {
            surfaces: Record<string, unknown>;
          }
        ).surfaces[SURFACE_ID],
      ),
      '{"username":"alice"}',
    );

    // Button
    const button = await find<HTMLButtonElement>('a2ui-basic-button button');
    assert.strictEqual(
      button.textContent?.includes('Sign In'),
      true,
      'button label',
    );
    await click(button);
    await waitUntil(() => actions.length > 0, { timeout: 3000 });

    assert.strictEqual(actions.length, 1);
    const { action, envelope } = actions[0]!;
    assert.strictEqual(action.name, 'login_submitted');
    assert.strictEqual(action.surfaceId, SURFACE_ID);
    assert.strictEqual(action.sourceComponentId, 'submit_button');
    assert.strictEqual(JSON.stringify(action.context), '{"user":"alice"}');
    assert.strictEqual((envelope as { version: string }).version, '1.0');
    assert.false('catalogId' in (envelope as { action: object }).action);

    session.dispose();
  });

  test('deleting a surface updates session.surfaces', function (assert) {
    const session = new A2uiSession();
    session.processMessages(JSON.stringify(scaffoldSimpleLoginForm));
    assert.strictEqual(session.surfaces.length, 1);
    session.processMessages({
      version: '1.0',
      deleteSurface: { surfaceId: SURFACE_ID },
    });
    assert.strictEqual(session.surfaces.length, 0);
    session.dispose();
  });
});
