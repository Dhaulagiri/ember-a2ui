// Adapted from google/A2UI (Apache-2.0): catalogs/basic/v1/examples/scaffold-simple-text.json
import type { Sample } from './types';

const sample: Sample = {
  id: 'scaffold-simple-text',
  name: 'Simple Text',
  version: '1.0',
  group: 'Basic catalog',
  description: 'Simple example demonstrating basic catalog components.',
  messages: [
    {
      version: '1.0',
      createSurface: {
        surfaceId: 'gallery-simple-text',
        catalogId:
          'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json',
      },
    },
    {
      version: '1.0',
      updateComponents: {
        surfaceId: 'gallery-simple-text',
        components: [
          { id: 'root', component: 'Text', text: '# Hello, Minimal Catalog!' },
        ],
      },
    },
  ],
};

export default sample;
