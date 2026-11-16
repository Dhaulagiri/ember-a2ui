// Original sample for this demo. A multi-turn agent conversation that streams
// a form, answers its action with a second surface, keeps both surfaces in
// sync with data model updates and finally deletes a surface.
import type { ActionLike, Sample } from './types';

const CATALOG =
  'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json';
const SEARCH = 'cabin-search';
const RESERVATION = 'cabin-reservation';
const v = '1.0';
const at = (path: string) => ({ '@path': path });
const text = (id: string, value: unknown, variant?: 'caption' | 'body') => ({
  id,
  component: 'Text',
  text: value,
  ...(variant ? { variant } : {}),
});
const label = (id: string, value: string) => text(id, value);

function str(context: Record<string, unknown> | undefined, key: string) {
  const value = context?.[key];
  return typeof value === 'string' ? value : '';
}

function reserve(action: ActionLike): unknown[] {
  const ctx = action.context ?? {};
  const name = str(ctx, 'name').trim() || 'Guest';
  const nights = Number(ctx['nights']) || 2;
  const cabin = Array.isArray(ctx['cabin']) ? String(ctx['cabin'][0]) : 'loft';
  const rate = cabin === 'aframe' ? 245 : cabin === 'lakeside' ? 310 : 189;
  return [
    {
      version: v,
      updateDataModel: {
        surfaceId: SEARCH,
        path: '/status',
        value: 'Checking availability…',
      },
    },
    {
      version: v,
      createSurface: {
        surfaceId: RESERVATION,
        catalogId: CATALOG,
        sendDataModel: true,
      },
    },
    {
      version: v,
      updateComponents: {
        surfaceId: RESERVATION,
        components: [
          { id: 'root', component: 'Card', child: 'r_col' },
          {
            id: 'r_col',
            component: 'Column',
            align: 'stretch',
            children: [
              'r_head',
              'r_summary',
              'r_total',
              'r_divider',
              'r_steps_label',
              'r_steps',
              'r_actions',
            ],
          },
          {
            id: 'r_head',
            component: 'Row',
            align: 'center',
            children: ['r_icon', 'r_title'],
          },
          { id: 'r_icon', component: 'Icon', name: 'check' },
          text('r_title', {
            '@call': 'formatString',
            args: { value: '### Reserved for ${/guest}' },
          }),
          text(
            'r_summary',
            {
              '@call': 'formatString',
              args: {
                value:
                  "${/cabinName} · ${/nights} ${pluralize(value: ${/nights}, one: 'night', other: 'nights')} · confirmation ${/code}",
              },
            },
            'caption',
          ),
          text('r_total', {
            '@call': 'formatString',
            args: {
              value:
                "**Total ${formatCurrency(value: ${/total}, currency: 'USD')}** (${formatCurrency(value: ${/rate}, currency: 'USD')} a night)",
            },
          }),
          { id: 'r_divider', component: 'Divider' },
          label('r_steps_label', 'Before you go'),
          {
            id: 'r_steps',
            component: 'List',
            children: { path: '/steps', componentId: 'r_step' },
          },
          {
            id: 'r_step',
            component: 'Row',
            align: 'center',
            children: ['r_step_icon', 'r_step_text'],
          },
          { id: 'r_step_icon', component: 'Icon', name: at('icon') },
          text('r_step_text', at('text'), 'body'),
          {
            id: 'r_actions',
            component: 'Row',
            justify: 'spaceBetween',
            children: ['r_rules', 'r_cancel'],
          },
          {
            id: 'r_rules',
            component: 'Modal',
            trigger: 'r_rules_btn',
            content: 'r_rules_body',
          },
          label('r_rules_btn_text', 'House rules'),
          {
            id: 'r_rules_btn',
            component: 'Button',
            variant: 'borderless',
            child: 'r_rules_btn_text',
            action: { event: { name: 'open_house_rules', context: {} } },
          },
          {
            id: 'r_rules_body',
            component: 'Column',
            children: ['r_rules_title', 'r_rules_text'],
          },
          label('r_rules_title', '### House rules'),
          text(
            'r_rules_text',
            '- Quiet hours 10pm to 7am\n- Pack out what you pack in\n- Keep the wood stove door closed',
            'body',
          ),
          label('r_cancel_text', 'Cancel reservation'),
          {
            id: 'r_cancel',
            component: 'Button',
            child: 'r_cancel_text',
            action: {
              event: {
                name: 'cancel_reservation',
                context: { code: at('/code') },
              },
            },
          },
        ],
      },
    },
    {
      version: v,
      updateDataModel: {
        surfaceId: RESERVATION,
        value: {
          guest: name,
          nights,
          rate,
          total: rate * nights,
          code: 'PH-4821',
          cabinName:
            cabin === 'aframe'
              ? 'A-frame'
              : cabin === 'lakeside'
                ? 'Lakeside cabin'
                : 'Forest loft',
          steps: [
            { icon: 'mail', text: `Confirmation sent to ${str(ctx, 'email')}` },
            {
              icon: 'lock',
              text: 'Door code arrives the morning you check in',
            },
            {
              icon: 'locationOn',
              text: 'Parking is 200m down the gravel road',
            },
          ],
        },
      },
    },
    {
      version: v,
      updateDataModel: {
        surfaceId: SEARCH,
        path: '/status',
        value: 'Booked. Your reservation is below.',
      },
    },
  ];
}

function cancel(): unknown[] {
  return [
    { version: v, deleteSurface: { surfaceId: RESERVATION } },
    {
      version: v,
      updateDataModel: {
        surfaceId: SEARCH,
        path: '/status',
        value: 'Reservation PH-4821 cancelled. Nothing was charged.',
      },
    },
  ];
}

const sample: Sample = {
  id: 'cabin-booking',
  name: 'Cabin Booking',
  version: '1.0',
  group: 'Showcase',
  description:
    'A multi-turn agent: it streams a booking form, answers the submit with a second surface, keeps both in sync and deletes one on cancel.',
  prompt: 'Find me a cabin near Pine Hollow for a long weekend.',
  respond(action) {
    if (action.name === 'reserve_cabin') return reserve(action);
    if (action.name === 'cancel_reservation') return cancel();
    return undefined;
  },
  messages: [
    {
      version: v,
      createSurface: {
        surfaceId: SEARCH,
        catalogId: CATALOG,
        sendDataModel: true,
      },
    },
    // The agent sends the outline first; children it names but has not sent
    // yet simply render once they arrive.
    {
      version: v,
      updateComponents: {
        surfaceId: SEARCH,
        components: [
          { id: 'root', component: 'Card', child: 'col' },
          {
            id: 'col',
            component: 'Column',
            align: 'stretch',
            children: ['hero', 'title', 'place', 'status', 'divider', 'form'],
          },
          {
            id: 'hero',
            component: 'Image',
            url: at('/image'),
            variant: 'header',
            fit: 'cover',
            description: 'Pine forest at dusk',
          },
          label('title', '## Pine Hollow Cabins'),
          {
            id: 'place',
            component: 'Row',
            align: 'center',
            children: ['place_icon', 'place_text', 'rating_icon', 'rating'],
          },
          { id: 'place_icon', component: 'Icon', name: 'locationOn' },
          text('place_text', at('/location'), 'caption'),
          { id: 'rating_icon', component: 'Icon', name: 'star' },
          text(
            'rating',
            {
              '@call': 'formatString',
              args: {
                value:
                  "${/rating} (${formatNumber(value: ${/reviews})} ${pluralize(value: ${/reviews}, one: 'review', other: 'reviews')})",
              },
            },
            'caption',
          ),
          text('status', at('/status'), 'body'),
          { id: 'divider', component: 'Divider' },
        ],
      },
    },
    {
      version: v,
      updateDataModel: {
        surfaceId: SEARCH,
        value: {
          image:
            'https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?w=640&h=240&fit=crop',
          location: 'Pine Hollow, 2h from the city',
          rating: '4.8',
          reviews: 312,
          status: 'Three cabins are free this weekend.',
          booking: {
            checkIn: '2026-12-11',
            nights: 3,
            guests: 2,
            cabin: ['loft'],
            extras: ['firewood'],
            name: '',
            email: '',
            pets: false,
          },
        },
      },
    },
    {
      version: v,
      updateComponents: {
        surfaceId: SEARCH,
        components: [
          {
            id: 'form',
            component: 'Column',
            align: 'stretch',
            children: [
              'cabin',
              'dates',
              'nights',
              'guests',
              'extras',
              'who',
              'pets',
              'reserve',
            ],
          },
          {
            id: 'cabin',
            component: 'ChoicePicker',
            label: 'Cabin',
            variant: 'mutuallyExclusive',
            displayStyle: 'chips',
            value: at('/booking/cabin'),
            options: [
              { label: 'Forest loft · $189', value: 'loft' },
              { label: 'A-frame · $245', value: 'aframe' },
              { label: 'Lakeside · $310', value: 'lakeside' },
            ],
          },
          {
            id: 'dates',
            component: 'DateTimeInput',
            label: 'Check in',
            enableDate: true,
            enableTime: false,
            value: at('/booking/checkIn'),
          },
          {
            id: 'nights',
            component: 'Slider',
            label: 'Nights',
            min: 1,
            max: 7,
            steps: 6,
            value: at('/booking/nights'),
          },
          {
            id: 'guests',
            component: 'Slider',
            label: 'Guests',
            min: 1,
            max: 6,
            steps: 5,
            value: at('/booking/guests'),
          },
          {
            id: 'extras',
            component: 'ChoicePicker',
            label: 'Extras',
            variant: 'multipleSelection',
            displayStyle: 'checkbox',
            value: at('/booking/extras'),
            options: [
              { label: 'Firewood bundle', value: 'firewood' },
              { label: 'Breakfast basket', value: 'breakfast' },
              { label: 'Late checkout', value: 'late' },
            ],
          },
          {
            id: 'who',
            component: 'Row',
            align: 'start',
            children: ['name', 'email'],
          },
          {
            id: 'name',
            component: 'TextField',
            label: 'Name',
            placeholder: 'Ada Lovelace',
            value: at('/booking/name'),
            weight: 1,
          },
          {
            id: 'email',
            component: 'TextField',
            label: 'Email',
            placeholder: 'ada@example.com',
            value: at('/booking/email'),
            weight: 1,
            checks: [
              {
                condition: {
                  '@call': 'email',
                  args: { value: at('/booking/email') },
                },
                message: 'Enter a valid email address',
              },
            ],
          },
          {
            id: 'pets',
            component: 'CheckBox',
            label: 'Bringing a dog',
            value: at('/booking/pets'),
          },
          label('reserve_text', 'Reserve'),
          {
            id: 'reserve',
            component: 'Button',
            variant: 'primary',
            child: 'reserve_text',
            checks: [
              {
                condition: {
                  '@call': 'and',
                  args: {
                    values: [
                      {
                        '@call': 'required',
                        args: { value: at('/booking/name') },
                      },
                      {
                        '@call': 'email',
                        args: { value: at('/booking/email') },
                      },
                    ],
                  },
                },
                message: 'Add your name and a valid email to reserve.',
              },
            ],
            action: {
              event: {
                name: 'reserve_cabin',
                context: {
                  cabin: at('/booking/cabin'),
                  checkIn: at('/booking/checkIn'),
                  nights: at('/booking/nights'),
                  guests: at('/booking/guests'),
                  extras: at('/booking/extras'),
                  pets: at('/booking/pets'),
                  name: at('/booking/name'),
                  email: at('/booking/email'),
                },
              },
            },
          },
        ],
      },
    },
  ],
};

export default sample;
