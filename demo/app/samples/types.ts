export type ProtocolVersion = '1.0' | 'v0.9';

/** What the mock agent received from the client. */
export interface ActionLike {
  name: string;
  surfaceId: string;
  context?: Record<string, unknown>;
}

export interface Sample {
  id: string;
  name: string;
  /** Protocol version of the messages. */
  version: ProtocolVersion;
  /** Sidebar group. */
  group: 'Showcase' | 'Basic catalog' | 'v0.9';
  description: string;
  /** What the user asked the agent for; shown as the opening chat bubble. */
  prompt?: string;
  messages: unknown[];
  /**
   * A scripted agent turn: the messages the mock agent streams back when the
   * surface dispatches `action`. Return nothing to leave the action
   * unanswered. Samples without one use the generic login reply.
   */
  respond?: (action: ActionLike) => unknown[] | undefined;
}
