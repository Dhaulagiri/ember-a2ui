// Original sample for this demo: every component of the v1.0 basic catalog on
// one surface, grouped into tabs.
import type { Sample } from './types';

const SURFACE = 'component-gallery';
const v = '1.0';
const at = (path: string) => ({ '@path': path });
const text = (id: string, value: unknown, variant?: 'caption' | 'body') => ({
  id,
  component: 'Text',
  text: value,
  ...(variant ? { variant } : {}),
});

const sample: Sample = {
  id: 'component-gallery',
  name: 'Component Gallery',
  version: '1.0',
  group: 'Showcase',
  description:
    'All 18 components of the basic catalog on one surface: layout, display, input, action and navigation.',
  prompt: 'Show me every component you can render.',
  messages: [
    {
      version: v,
      createSurface: {
        surfaceId: SURFACE,
        catalogId:
          'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json',
        sendDataModel: true,
      },
    },
    {
      version: v,
      updateComponents: {
        surfaceId: SURFACE,
        components: [
          { id: 'root', component: 'Card', child: 'tabs' },
          {
            id: 'tabs',
            component: 'Tabs',
            tabs: [
              { title: 'Input', child: 'inputs' },
              { title: 'Display', child: 'display' },
              { title: 'Layout', child: 'layout' },
              { title: 'Media', child: 'media' },
            ],
          },

          // Input: TextField, CheckBox, ChoicePicker, Slider, DateTimeInput, Button
          {
            id: 'inputs',
            component: 'Column',
            align: 'stretch',
            children: [
              'tf_row',
              'tf_long',
              'picker_chips',
              'picker_multi',
              'slider',
              'datetime',
              'checkbox',
              'buttons',
              'echo',
            ],
          },
          {
            id: 'tf_row',
            component: 'Row',
            children: ['tf_short', 'tf_number', 'tf_secret'],
          },
          {
            id: 'tf_short',
            component: 'TextField',
            label: 'Short text',
            value: at('/form/name'),
            weight: 1,
          },
          {
            id: 'tf_number',
            component: 'TextField',
            label: 'Number',
            variant: 'number',
            value: at('/form/qty'),
            weight: 1,
          },
          {
            id: 'tf_secret',
            component: 'TextField',
            label: 'Obscured',
            variant: 'obscured',
            value: at('/form/secret'),
            weight: 1,
          },
          {
            id: 'tf_long',
            component: 'TextField',
            label: 'Long text',
            variant: 'longText',
            value: at('/form/notes'),
          },
          {
            id: 'picker_chips',
            component: 'ChoicePicker',
            label: 'ChoicePicker · chips',
            variant: 'mutuallyExclusive',
            displayStyle: 'chips',
            value: at('/form/size'),
            options: [
              { label: 'Small', value: 's' },
              { label: 'Medium', value: 'm' },
              { label: 'Large', value: 'l' },
            ],
          },
          {
            id: 'picker_multi',
            component: 'ChoicePicker',
            label: 'ChoicePicker · checkboxes, filterable',
            variant: 'multipleSelection',
            displayStyle: 'checkbox',
            filterable: true,
            value: at('/form/toppings'),
            options: [
              { label: 'Basil', value: 'basil' },
              { label: 'Mushroom', value: 'mushroom' },
              { label: 'Olive', value: 'olive' },
              { label: 'Pepper', value: 'pepper' },
            ],
          },
          {
            id: 'slider',
            component: 'Slider',
            label: 'Slider',
            min: 0,
            max: 100,
            value: at('/form/volume'),
          },
          {
            id: 'datetime',
            component: 'DateTimeInput',
            label: 'DateTimeInput',
            enableDate: true,
            enableTime: true,
            value: at('/form/when'),
          },
          {
            id: 'checkbox',
            component: 'CheckBox',
            label: 'CheckBox',
            value: at('/form/agree'),
          },
          {
            id: 'buttons',
            component: 'Row',
            children: ['btn_primary', 'btn_default', 'btn_borderless'],
          },
          text('btn_primary_text', 'Primary'),
          {
            id: 'btn_primary',
            component: 'Button',
            variant: 'primary',
            child: 'btn_primary_text',
            action: {
              event: {
                name: 'gallery_primary',
                context: { form: at('/form') },
              },
            },
          },
          text('btn_default_text', 'Default'),
          {
            id: 'btn_default',
            component: 'Button',
            child: 'btn_default_text',
            action: { event: { name: 'gallery_default', context: {} } },
          },
          { id: 'btn_borderless_icon', component: 'Icon', name: 'share' },
          {
            id: 'btn_borderless',
            component: 'Button',
            variant: 'borderless',
            child: 'btn_borderless_icon',
            action: { event: { name: 'gallery_share', context: {} } },
          },
          text(
            'echo',
            {
              '@call': 'formatString',
              args: {
                value:
                  'Bound values: ${/form/name}, qty ${/form/qty}, volume ${/form/volume}, agree ${/form/agree}',
              },
            },
            'caption',
          ),

          // Display: Text, Icon, Image
          {
            id: 'display',
            component: 'Column',
            children: ['md', 'body', 'caption', 'icons', 'images', 'func_text'],
          },
          text('md', '## Text with **markdown**, `code` and _emphasis_'),
          text('body', 'Body text variant.', 'body'),
          text('caption', 'Caption text variant.', 'caption'),
          {
            id: 'icons',
            component: 'Row',
            align: 'center',
            children: { path: '/icons', componentId: 'icon_item' },
          },
          { id: 'icon_item', component: 'Icon', name: at('name') },
          {
            id: 'images',
            component: 'Row',
            align: 'center',
            children: ['img_avatar', 'img_small', 'img_medium'],
          },
          {
            id: 'img_avatar',
            component: 'Image',
            variant: 'avatar',
            url: at('/images/avatar'),
            description: 'Avatar',
          },
          {
            id: 'img_small',
            component: 'Image',
            variant: 'smallFeature',
            fit: 'cover',
            url: at('/images/feature'),
            description: 'Small feature',
          },
          {
            id: 'img_medium',
            component: 'Image',
            variant: 'mediumFeature',
            fit: 'cover',
            url: at('/images/feature'),
            description: 'Medium feature',
          },
          text(
            'func_text',
            {
              '@call': 'formatString',
              args: {
                value:
                  "Functions: ${formatCurrency(value: ${/price}, currency: 'EUR')} · ${formatNumber(value: ${/visits})} visits · ${/items} ${pluralize(value: ${/items}, one: 'item', other: 'items')}",
              },
            },
            'body',
          ),

          // Layout: Row, Column, List, Card, Divider; navigation: Modal
          {
            id: 'layout',
            component: 'Column',
            align: 'stretch',
            children: [
              'row_caption',
              'weighted_row',
              'divider_h',
              'list_caption',
              'h_list',
              'divider_h2',
              'modal',
            ],
          },
          text('row_caption', 'Row with weighted children (1 : 2)', 'caption'),
          {
            id: 'weighted_row',
            component: 'Row',
            children: ['card_a', 'divider_v', 'card_b'],
          },
          { id: 'card_a', component: 'Card', child: 'card_a_text', weight: 1 },
          text('card_a_text', 'Card · weight 1'),
          { id: 'divider_v', component: 'Divider', axis: 'vertical' },
          { id: 'card_b', component: 'Card', child: 'card_b_text', weight: 2 },
          text('card_b_text', 'Card · weight 2'),
          { id: 'divider_h', component: 'Divider' },
          text(
            'list_caption',
            'Horizontal List from a data template',
            'caption',
          ),
          {
            id: 'h_list',
            component: 'List',
            direction: 'horizontal',
            children: { path: '/team', componentId: 'person' },
          },
          { id: 'person', component: 'Card', child: 'person_col' },
          {
            id: 'person_col',
            component: 'Column',
            align: 'center',
            children: ['person_icon', 'person_name', 'person_role'],
          },
          { id: 'person_icon', component: 'Icon', name: 'accountCircle' },
          text('person_name', at('name')),
          text('person_role', at('role'), 'caption'),
          { id: 'divider_h2', component: 'Divider' },
          {
            id: 'modal',
            component: 'Modal',
            trigger: 'modal_btn',
            content: 'modal_body',
          },
          text('modal_btn_text', 'Open a Modal'),
          {
            id: 'modal_btn',
            component: 'Button',
            child: 'modal_btn_text',
            action: { event: { name: 'gallery_modal', context: {} } },
          },
          {
            id: 'modal_body',
            component: 'Column',
            children: ['modal_title', 'modal_text'],
          },
          text('modal_title', '### Modal'),
          text('modal_text', 'Content rendered inside a dialog.', 'body'),

          // Media: Video, AudioPlayer
          {
            id: 'media',
            component: 'Column',
            align: 'stretch',
            children: ['video', 'audio'],
          },
          {
            id: 'video',
            component: 'Video',
            url: at('/media/video'),
          },
          {
            id: 'audio',
            component: 'AudioPlayer',
            url: at('/media/audio'),
            description: 'AudioPlayer',
          },
        ],
      },
    },
    {
      version: v,
      updateDataModel: {
        surfaceId: SURFACE,
        value: {
          form: {
            name: 'Tomster',
            qty: '3',
            secret: 'hunter2',
            notes: 'Multi-line\ntext',
            size: ['m'],
            toppings: ['basil', 'olive'],
            volume: 40,
            when: '2026-12-24T18:30:00Z',
            agree: true,
          },
          icons: [
            { name: 'home' },
            { name: 'search' },
            { name: 'favorite' },
            { name: 'notifications' },
            { name: 'settings' },
            { name: 'shoppingCart' },
            { name: 'calendarToday' },
            { name: 'mail' },
          ],
          images: {
            avatar:
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=96&h=96&fit=crop',
            feature:
              'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=400&h=240&fit=crop',
          },
          price: 1234.5,
          visits: 1048576,
          items: 1,
          team: [
            { name: 'Ada', role: 'Agent' },
            { name: 'Grace', role: 'Renderer' },
            { name: 'Linus', role: 'Catalog' },
          ],
          media: {
            video:
              'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
            audio:
              'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3',
          },
        },
      },
    },
  ],
};

export default sample;
