import type { Sample } from '../samples/types';

export interface ActionLike {
  name: string;
  surfaceId: string;
  context?: Record<string, unknown>;
}

const TRIGGER = /submit|login|sign.?in/i;

/** Does the mock agent want to answer this action? */
export function shouldRespond(action: ActionLike): boolean {
  return TRIGGER.test(action.name);
}

function pickName(context: Record<string, unknown> = {}): string {
  for (const key of ['user', 'username', 'name', 'email']) {
    const v = context[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return 'friend';
}

/**
 * Build the messages a (pretend) agent would send back after a login-ish
 * action: write a greeting into the data model and replace the root component
 * with a Card showing it.
 */
export function buildReply(
  action: ActionLike,
  version: Sample['version'],
): unknown[] {
  const { surfaceId } = action;
  const v09 = version === 'v0.9';
  const bind = (path: string) => (v09 ? { path } : { '@path': path });
  return [
    {
      version,
      updateDataModel: {
        surfaceId,
        path: '/welcome',
        value: `Welcome, ${pickName(action.context)}`,
      },
    },
    {
      version,
      updateComponents: {
        surfaceId,
        components: [
          {
            id: 'root',
            component: 'Card',
            child: 'welcome_col',
          },
          {
            id: 'welcome_col',
            component: 'Column',
            children: ['welcome_title', 'welcome_hint'],
          },
          {
            id: 'welcome_title',
            component: 'Text',
            text: bind('/welcome'),
            ...(v09 ? { variant: 'h2' } : {}),
          },
          {
            id: 'welcome_hint',
            component: 'Text',
            text: 'This reply came from the mock agent (300ms round trip).',
          },
        ],
      },
    },
  ];
}
