// Adapted from google/A2UI (Apache-2.0): specification/v0_9/catalogs/basic/examples/scaffold-simple-login-form.json
import type { Sample } from './types';

const sample: Sample = {
  id: 'v0-9-scaffold-simple-login-form',
  name: 'Simple Login Form',
  version: 'v0.9',
  group: 'v0.9',
  prompt: 'Sign me in.',
  description: 'Simple example demonstrating basic catalog components.',
  messages: [
    {
      version: 'v0.9',
      createSurface: {
        surfaceId: 'gallery-simple-login-form',
        catalogId:
          'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json',
        sendDataModel: true,
      },
    },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'gallery-simple-login-form',
        components: [
          {
            id: 'root',
            component: 'Column',
            children: [
              'form_title',
              'username_field',
              'password_field',
              'submit_button',
            ],
            justify: 'start',
            align: 'stretch',
          },
          { id: 'form_title', component: 'Text', text: 'Login', variant: 'h2' },
          {
            id: 'username_field',
            component: 'TextField',
            label: 'Username',
            value: { path: '/username' },
            variant: 'shortText',
          },
          {
            id: 'password_field',
            component: 'TextField',
            label: 'Password',
            value: { path: '/password' },
            variant: 'obscured',
          },
          {
            id: 'submit_button',
            component: 'Button',
            child: 'submit_label',
            variant: 'primary',
            action: {
              event: {
                name: 'login_submitted',
                context: {
                  user: { path: '/username' },
                  pass: { path: '/password' },
                },
              },
            },
          },
          { id: 'submit_label', component: 'Text', text: 'Sign In' },
        ],
      },
    },
  ],
};

export default sample;
