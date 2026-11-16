export interface Sample {
  id: string;
  name: string;
  /** Protocol version of the messages. */
  version: '1.0' | 'v0.9';
  description: string;
  messages: unknown[];
}
