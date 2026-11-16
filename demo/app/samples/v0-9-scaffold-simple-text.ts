// Adapted from google/A2UI (Apache-2.0): specification/v0_9/catalogs/basic/examples/scaffold-simple-text.json
import type { Sample } from './types';

const sample: Sample = {
  id: 'v0-9-scaffold-simple-text',
  name: 'Simple Text',
  version: 'v0.9',
  group: 'v0.9',
  description: 'Simple example demonstrating basic catalog components.',
  messages: [
    {
      version: 'v0.9',
      createSurface: {
        surfaceId: 'gallery-simple-text',
        catalogId:
          'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json',
      },
    },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'gallery-simple-text',
        components: [
          {
            id: 'root',
            component: 'Text',
            text: 'Hello, Minimal Catalog!',
            variant: 'h1',
          },
        ],
      },
    },
  ],
};

export default sample;
