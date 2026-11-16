import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import { isDestroying, registerDestructor } from '@ember/destroyable';
import { A2uiSession, A2uiSurfaces } from 'ember-a2ui';
import { SAMPLES, findSample } from '../samples';
import type { Sample } from '../samples';
import { agentReply } from '../utils/mock-agent';
import type { ActionLike } from '../utils/mock-agent';

interface Run {
  id: number;
  session: A2uiSession;
}

interface LogEntry {
  n: number;
  time: string;
  name: string;
  surfaceId: string;
  context: string;
}

const AGENT_DELAY_MS = 300;
const pretty = (v: unknown) => JSON.stringify(v, null, 2);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default class Explorer extends Component {
  @tracked selectedId: string = SAMPLES[0]?.id ?? '';
  @tracked editorText = '';
  @tracked error = '';
  @tracked log: LogEntry[] = [];
  @tracked dataModel = '';
  // A one-element list so `{{#each key="id"}}` tears the surfaces down and
  // builds a fresh tree whenever a new run (session) starts.
  @tracked runs: Run[] = [];

  private runCounter = 0;
  private logCounter = 0;

  constructor(owner: unknown, args: object) {
    super(owner as never, args);
    registerDestructor(this, () => this.disposeRuns());
    // Load the first sample after this render: select() reads and writes
    // tracked state, which Ember forbids inside the same render.
    queueMicrotask(() => {
      if (!isDestroying(this)) this.select(this.sample);
    });
  }

  get sample(): Sample {
    return findSample(this.selectedId);
  }

  get sampleItems() {
    return SAMPLES.map((sample) => ({
      sample,
      active: sample.id === this.selectedId,
    }));
  }

  get hasLog() {
    return this.log.length > 0;
  }

  private disposeRuns() {
    for (const run of this.runs) run.session.dispose();
    this.runs = [];
  }

  private current(run: Run) {
    return this.runs[0] === run;
  }

  private start(messages: unknown) {
    this.disposeRuns();
    const run: Run = {
      id: ++this.runCounter,
      session: new A2uiSession({
        onAction: (action: ActionLike) => this.handleAction(run, action),
      }),
    };
    this.runs = [run];
    this.dataModel = '';
    // Feed messages after render (never from inside a render/constructor).
    void this.feed(run, messages);
  }

  private async feed(run: Run, messages: unknown) {
    await Promise.resolve();
    if (!this.current(run)) return;
    try {
      run.session.processMessages(messages);
      this.error = '';
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    }
    this.refreshModel();
  }

  private async handleAction(run: Run, action: ActionLike) {
    this.log = [
      ...this.log,
      {
        n: ++this.logCounter,
        time: new Date().toLocaleTimeString(),
        name: action.name,
        surfaceId: action.surfaceId,
        context: pretty(action.context ?? {}),
      },
    ];
    this.refreshModel();
    const reply = agentReply(this.sample, action);
    if (!reply) return;
    // Mock agent round trip: reply after a short delay, outside of render.
    await sleep(AGENT_DELAY_MS);
    if (!this.current(run)) return;
    try {
      run.session.processMessages(reply);
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    }
    this.refreshModel();
  }

  private refreshModel() {
    const run = this.runs[0];
    if (!run) return;
    try {
      const meta = run.session.getClientMetadata() as {
        a2uiRendererDataModel?: unknown;
      };
      this.dataModel = pretty(meta.a2uiRendererDataModel ?? {});
    } catch (e) {
      this.dataModel = `// ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  private select(sample: Sample) {
    this.selectedId = sample.id;
    this.editorText = pretty(sample.messages);
    this.log = [];
    this.error = '';
    this.start(sample.messages);
  }

  selectSample = (sample: Sample) => this.select(sample);

  onEdit = (event: Event) => {
    this.editorText = (event.target as HTMLTextAreaElement).value;
  };

  apply = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(this.editorText);
    } catch (e) {
      this.error = `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`;
      return;
    }
    this.error = '';
    this.start(parsed);
  };

  refresh = () => this.refreshModel();

  clearLog = () => {
    this.log = [];
  };

  <template>
    <div class="explorer">
      <nav class="explorer-sidebar" aria-label="Samples">
        <h2>Samples</h2>
        <ul>
          {{#each this.sampleItems as |item|}}
            <li>
              <button
                type="button"
                class="sample-btn"
                aria-current={{if item.active "true"}}
                data-test-sample={{item.sample.id}}
                {{on "click" (fn this.selectSample item.sample)}}
              >
                <span>{{item.sample.name}}</span>
                <small>{{item.sample.version}}</small>
              </button>
            </li>
          {{/each}}
        </ul>
      </nav>

      <main class="explorer-main">
        <header>
          <h2 data-test-sample-title>{{this.sample.name}}</h2>
          <p>{{this.sample.description}}</p>
        </header>
        <div class="preview" data-test-preview>
          {{#each this.runs key="id" as |run|}}
            <A2uiSurfaces @session={{run.session}} />
          {{/each}}
        </div>
      </main>

      <aside class="explorer-side">
        <section>
          <h3>Messages</h3>
          <textarea
            class="editor"
            spellcheck="false"
            aria-label="A2UI messages (JSON)"
            data-test-editor
            value={{this.editorText}}
            {{on "input" this.onEdit}}
          ></textarea>
          <div class="row">
            <button type="button" data-test-apply {{on "click" this.apply}}>
              Apply
            </button>
            {{#if this.error}}
              <span class="error" role="alert" data-test-error>
                {{this.error}}
              </span>
            {{/if}}
          </div>
        </section>

        <section>
          <h3>Action log</h3>
          {{#if this.hasLog}}
            <ol class="log" data-test-action-log>
              {{#each this.log as |entry|}}
                <li>
                  <strong>{{entry.name}}</strong>
                  <small>{{entry.surfaceId}} · {{entry.time}}</small>
                  <pre>{{entry.context}}</pre>
                </li>
              {{/each}}
            </ol>
            <button type="button" {{on "click" this.clearLog}}>Clear</button>
          {{else}}
            <p class="muted">No actions yet. Interact with a button.</p>
          {{/if}}
        </section>

        <section>
          <h3>Data model</h3>
          <pre class="model" data-test-data-model>{{this.dataModel}}</pre>
          <button type="button" {{on "click" this.refresh}}>Refresh</button>
        </section>
      </aside>
    </div>
  </template>
}
