// Adapted from google/A2UI (Apache-2.0): catalogs/basic/v1/examples/modal.json
import type { Sample } from './types';

const sample: Sample = {
  id: 'modal',
  name: 'Modal Sample',
  version: '1.0',
  group: 'Basic catalog',
  description: 'Example of Modal component showing a trigger and content.',
  messages: [
    {
      version: '1.0',
      createSurface: {
        surfaceId: 'modal-sample-surface',
        catalogId:
          'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json',
        sendDataModel: true,
      },
    },
    {
      version: '1.0',
      updateComponents: {
        surfaceId: 'modal-sample-surface',
        components: [
          {
            id: 'root',
            component: 'Column',
            children: ['title', 'modal_comp'],
          },
          { id: 'title', component: 'Text', text: '## Modal Component Sample' },
          {
            id: 'modal_comp',
            component: 'Modal',
            trigger: 'open_btn',
            content: 'modal_content',
          },
          { id: 'open_btn_text', component: 'Text', text: 'Open Modal' },
          {
            id: 'open_btn',
            component: 'Button',
            child: 'open_btn_text',
            action: { event: { name: 'openModalEvent', context: {} } },
          },
          {
            id: 'modal_content',
            component: 'Column',
            children: ['modal_text'],
          },
          {
            id: 'modal_text',
            component: 'Text',
            text: 'This is the content inside the modal.',
          },
        ],
      },
    },
  ],
};

export default sample;
