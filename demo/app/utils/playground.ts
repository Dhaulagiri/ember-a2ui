import { tracked } from '@glimmer/tracking';
import { buildWaiter } from '@ember/test-waiters';
import { A2uiSession } from 'ember-a2ui';
import type { ActionEnvelope } from 'ember-a2ui';
import config from 'demo/config/environment';
import type { ActionLike } from '../samples';
import { byteSize, pretty, summarize } from './wire';
import type { MessageSummary } from './wire';

const waiter = buildWaiter('demo:playground');
const TESTING = config.environment === 'test';

/** Delay between streamed messages at 1× speed. */
const MESSAGE_DELAY_MS = 600;
/** How long the mock agent "thinks" before it answers an action. */
const THINK_DELAY_MS = 700;

export const SPEEDS = [
  { label: '0.5×', value: 0.5 },
  { label: '1×', value: 1 },
  { label: '2×', value: 2 },
  { label: 'Instant', value: 0 },
] as const;

export interface WireEntry {
  /** Unique, stable key. */
  key: string;
  /** `down`: agent to client. `up`: client to agent. */
  dir: 'down' | 'up';
  /** `script`: the sample's opening turn. `agent`: a reply to an action. */
  origin: 'script' | 'agent' | 'client';
  summary: MessageSummary;
  json: string;
  bytes: number;
  /** Index into the script for scripted messages, otherwise -1. */
  scriptIndex: number;
  /** Not delivered yet (only scripted messages can be pending). */
  pending: boolean;
  time: string;
}

export interface Run {
  id: number;
  session: A2uiSession;
}

export type Responder = (action: ActionLike) => unknown[] | undefined;

function sleep(ms: number): Promise<void> {
  if (ms <= 0 || TESTING) return Promise.resolve();
  const token = waiter.beginAsync();
  return new Promise((resolve) =>
    setTimeout(() => {
      waiter.endAsync(token);
      resolve();
    }, ms),
  );
}

const now = () =>
  new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

/**
 * Streams a scripted agent turn into an `A2uiSession` one message at a time,
 * logs every message that crosses the wire (both directions) and lets the
 * mock agent answer actions. Seeking replays the script into a fresh session.
 */
export class Playground {
  /** At most one run; a new id tells the template to rebuild the surfaces. */
  @tracked runs: Run[] = [];
  @tracked script: unknown[] = [];
  /** Number of scripted messages delivered so far. */
  @tracked cursor = 0;
  @tracked playing = false;
  @tracked speed: number = TESTING ? 0 : 1;
  @tracked log: WireEntry[] = [];
  @tracked error = '';
  /** The mock agent is preparing a reply. */
  @tracked thinking = false;
  /** Bumped whenever surface state may have changed outside tracking. */
  @tracked revision = 0;

  #scriptEntries: WireEntry[] = [];
  #runCounter = 0;
  #entryCounter = 0;
  #generation = 0;
  #respond: Responder;

  constructor(respond: Responder) {
    this.#respond = respond;
  }

  get session(): A2uiSession | undefined {
    return this.runs[0]?.session;
  }

  get total(): number {
    return this.script.length;
  }

  get atEnd(): boolean {
    return this.cursor >= this.total;
  }

  /** Delivered messages followed by the scripted ones still to come. */
  get timeline(): WireEntry[] {
    return [...this.log, ...this.#scriptEntries.slice(this.cursor)];
  }

  get stats() {
    void this.revision;
    let down = 0;
    let up = 0;
    let bytesDown = 0;
    let bytesUp = 0;
    for (const e of this.log) {
      if (e.dir === 'down') {
        down++;
        bytesDown += e.bytes;
      } else {
        up++;
        bytesUp += e.bytes;
      }
    }
    const surfaces = this.session?.surfaces ?? [];
    const components = surfaces.reduce((n, s) => n + s.componentsModel.size, 0);
    return {
      down,
      up,
      bytesDown,
      bytesUp,
      components,
      surfaces: surfaces.length,
    };
  }

  /** Each live surface's data model, pretty-printed. */
  get dataModels(): { surfaceId: string; json: string }[] {
    void this.revision;
    return (this.session?.surfaces ?? []).map((s) => ({
      surfaceId: s.id,
      json: pretty(s.dataModel.get('/') ?? {}),
    }));
  }

  /** What the client attaches to every request it sends the agent. */
  get capabilities(): string {
    void this.revision;
    try {
      return pretty(this.session?.getClientMetadata().a2uiRendererCapabilities);
    } catch (e) {
      return `// ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  /** Something outside the protocol (user input) may have changed state. */
  touch(): void {
    this.revision++;
  }

  /** Loads a new script. Call outside of a render. */
  load(script: unknown[], { autoplay = true } = {}): void {
    this.pause();
    this.script = script;
    this.#scriptEntries = script.map((message, i) =>
      this.#entry(message, 'down', 'script', i, true),
    );
    this.#reset();
    if (autoplay) void this.play();
  }

  async play(): Promise<void> {
    if (this.playing) return;
    if (this.atEnd) this.#reset();
    const generation = ++this.#generation;
    this.playing = true;
    // A short beat before the first message so the stream reads as one.
    let delay = this.cursor === 0 ? 250 : this.#delay(MESSAGE_DELAY_MS);
    while (this.cursor < this.total) {
      await sleep(this.speed === 0 ? 0 : delay);
      if (generation !== this.#generation) return;
      this.#deliver(this.cursor);
      delay = this.#delay(MESSAGE_DELAY_MS);
    }
    this.playing = false;
  }

  pause(): void {
    this.#generation++;
    this.playing = false;
  }

  toggle = (): void => {
    if (this.playing) this.pause();
    else void this.play();
  };

  step = (): void => {
    this.pause();
    if (!this.atEnd) this.#deliver(this.cursor);
  };

  back = (): void => {
    this.seek(Math.max(0, this.cursor - 1));
  };

  restart = (): void => {
    this.seek(0);
    void this.play();
  };

  /** Rebuilds the session with the first `count` scripted messages. */
  seek = (count: number): void => {
    this.pause();
    this.#reset();
    const end = Math.min(Math.max(count, 0), this.total);
    for (let i = 0; i < end; i++) this.#deliver(i);
  };

  setSpeed = (speed: number): void => {
    this.speed = speed;
  };

  dispose(): void {
    this.pause();
    for (const run of this.runs) run.session.dispose();
    this.runs = [];
  }

  #delay(ms: number): number {
    return this.speed === 0 ? 0 : ms / this.speed;
  }

  #reset(): void {
    this.dispose();
    const run: Run = {
      id: ++this.#runCounter,
      session: new A2uiSession({
        onAction: (action, envelope) => this.#onAction(run, action, envelope),
      }),
    };
    this.runs = [run];
    this.cursor = 0;
    this.log = [];
    this.error = '';
    this.thinking = false;
  }

  #entry(
    message: unknown,
    dir: WireEntry['dir'],
    origin: WireEntry['origin'],
    scriptIndex = -1,
    pending = false,
  ): WireEntry {
    return {
      key: `e${++this.#entryCounter}`,
      dir,
      origin,
      summary: summarize(message),
      json: pretty(message),
      bytes: byteSize(message),
      scriptIndex,
      pending,
      time: pending ? '' : now(),
    };
  }

  #process(message: unknown): void {
    try {
      this.session?.processMessages(message);
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    }
  }

  #deliver(index: number): void {
    const message = this.script[index];
    const scripted = this.#scriptEntries[index];
    this.#process(message);
    this.log = [
      ...this.log,
      scripted
        ? { ...scripted, pending: false, time: now() }
        : this.#entry(message, 'down', 'script', index),
    ];
    this.cursor = index + 1;
    this.revision++;
  }

  async #onAction(
    run: Run,
    action: ActionLike,
    envelope: ActionEnvelope,
  ): Promise<void> {
    if (this.runs[0] !== run) return;
    this.log = [...this.log, this.#entry(envelope, 'up', 'client')];
    this.revision++;

    const reply = this.#respond(action);
    if (!reply?.length) return;

    this.thinking = true;
    await sleep(this.#delay(THINK_DELAY_MS));
    for (const [i, message] of reply.entries()) {
      if (this.runs[0] !== run) return;
      if (i > 0) await sleep(this.#delay(MESSAGE_DELAY_MS / 2));
      if (this.runs[0] !== run) return;
      this.#process(message);
      this.log = [...this.log, this.#entry(message, 'down', 'agent')];
      this.revision++;
    }
    this.thinking = false;
  }
}
