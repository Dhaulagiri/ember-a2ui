import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import { htmlSafe } from '@ember/template';
import { isDestroying, registerDestructor } from '@ember/destroyable';
import { modifier } from 'ember-modifier';
import { A2uiSurfaces } from 'ember-a2ui';
import { GROUPS, SAMPLES, findSample } from '../samples';
import type { ActionLike, Sample } from '../samples';
import { agentReply, buildReply, shouldRespond } from '../utils/mock-agent';
import { Playground, SPEEDS } from '../utils/playground';
import {
  decodeMessages,
  encodeMessages,
  readHash,
  writeHash,
} from '../utils/share';
import { theme } from '../utils/theme';
import { formatBytes, pretty } from '../utils/wire';
import JsonBlock from './json-block';
import WireFeed from './wire-feed';

type Tab = 'wire' | 'edit' | 'state';

const TABS: { id: Tab; label: string }[] = [
  { id: 'wire', label: 'Wire' },
  { id: 'edit', label: 'Edit' },
  { id: 'state', label: 'State' },
];

const eq = (a: unknown, b: unknown) => a === b;

/**
 * Calls `handler` when the user types, picks or clicks inside the rendered
 * surfaces. Their custom elements write to the data model directly, so this
 * is how the inspector learns that it may have changed.
 */
const onSurfaceInput = modifier(
  (element: HTMLElement, [handler]: [() => void]) => {
    const events = ['input', 'change', 'click'];
    events.forEach((e) => element.addEventListener(e, handler));
    return () => events.forEach((e) => element.removeEventListener(e, handler));
  },
);

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName))
  );
}

export default class Explorer extends Component {
  @tracked selectedId: string = SAMPLES[0]?.id ?? '';
  /** Messages loaded from the editor or a shared link instead of a sample. */
  @tracked custom = false;
  @tracked editorText = '';
  @tracked editorError = '';
  @tracked tab: Tab = 'wire';
  @tracked shareStatus = '';

  theme = theme();
  playground = new Playground((action) => this.respond(action));

  #touchQueued = false;

  constructor(owner: unknown, args: object) {
    super(owner as never, args);
    const onHash = () => void this.loadFromHash();
    const onKey = (e: KeyboardEvent) => this.onKey(e);
    window.addEventListener('hashchange', onHash);
    document.addEventListener('keydown', onKey);
    registerDestructor(this, () => {
      window.removeEventListener('hashchange', onHash);
      document.removeEventListener('keydown', onKey);
      this.playground.dispose();
    });
    // Load after this render: loading reads and writes tracked state, which
    // Ember forbids inside the same render.
    queueMicrotask(() => {
      if (!isDestroying(this)) void this.loadFromHash();
    });
  }

  // ---- derived state ------------------------------------------------------

  get sample(): Sample {
    return findSample(this.selectedId);
  }

  get groups() {
    return GROUPS.map((group) => ({
      group,
      items: SAMPLES.filter((s) => s.group === group).map((sample) => ({
        sample,
        active: !this.custom && sample.id === this.selectedId,
      })),
    }));
  }

  get title() {
    return this.custom ? 'Custom messages' : this.sample.name;
  }

  get description() {
    return this.custom
      ? 'Messages from the editor or a shared link.'
      : this.sample.description;
  }

  get prompt() {
    return this.custom ? undefined : this.sample.prompt;
  }

  get previewStyle() {
    return htmlSafe(this.theme.previewStyle);
  }

  get progressLabel() {
    const { cursor, total } = this.playground;
    return `${cursor} / ${total}`;
  }

  get waitingForFirstSurface() {
    const p = this.playground;
    return p.stats.surfaces === 0 && !p.atEnd && !p.error;
  }

  get stats() {
    const s = this.playground.stats;
    return [
      {
        label: 'Agent → client',
        value: s.down,
        hint: formatBytes(s.bytesDown),
      },
      {
        label: 'Client → agent',
        value: s.up,
        hint: formatBytes(s.bytesUp),
      },
      { label: 'Components', value: s.components, hint: 'in the tree' },
      {
        label: 'Surfaces',
        value: s.surfaces,
        hint: this.custom ? 'custom' : `A2UI ${this.sample.version}`,
      },
    ];
  }

  get tabs() {
    const p = this.playground;
    const counts: Record<Tab, string> = {
      wire: String(p.log.length),
      edit: '',
      state: String(p.stats.surfaces),
    };
    return TABS.map((t) => ({
      ...t,
      count: counts[t.id],
      active: t.id === this.tab,
    }));
  }

  // ---- loading ------------------------------------------------------------

  private respond(action: ActionLike): unknown[] | undefined {
    if (!this.custom) return agentReply(this.sample, action);
    if (!shouldRespond(action)) return undefined;
    const surface = this.playground.session?.getSurface(action.surfaceId);
    const v09 = /^v?0\.9/.test(surface?.protocolVersion ?? '');
    return buildReply(action, v09 ? 'v0.9' : '1.0');
  }

  private async loadFromHash() {
    const state = readHash();
    if (state.kind === 'messages') {
      try {
        const messages = await decodeMessages(state.data);
        if (isDestroying(this)) return;
        this.loadCustom(messages);
        return;
      } catch {
        this.editorError = 'That shared link could not be decoded.';
      }
    }
    const id = state.kind === 'sample' ? state.id : SAMPLES[0]?.id;
    this.loadSample(findSample(id));
  }

  private loadSample(sample: Sample) {
    this.selectedId = sample.id;
    this.custom = false;
    this.editorText = pretty(sample.messages);
    this.editorError = '';
    this.shareStatus = '';
    this.playground.load(sample.messages);
  }

  private loadCustom(messages: unknown) {
    const list = Array.isArray(messages) ? messages : [messages];
    this.custom = true;
    this.editorText = pretty(list);
    this.editorError = '';
    this.playground.load(list);
  }

  // ---- actions ------------------------------------------------------------

  selectSample = (sample: Sample) => {
    writeHash(`sample=${sample.id}`);
    this.loadSample(sample);
  };

  selectTab = (tab: Tab) => {
    this.tab = tab;
  };

  onEdit = (event: Event) => {
    this.editorText = (event.target as HTMLTextAreaElement).value;
    this.shareStatus = '';
  };

  onEditorKey = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      this.apply();
    }
  };

  apply = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(this.editorText);
    } catch (e) {
      this.editorError = `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`;
      return;
    }
    writeHash('');
    this.loadCustom(parsed);
  };

  format = () => {
    try {
      this.editorText = pretty(JSON.parse(this.editorText));
      this.editorError = '';
    } catch (e) {
      this.editorError = `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`;
    }
  };

  share = async () => {
    try {
      const hash = this.custom
        ? `messages=${await encodeMessages(this.editorText)}`
        : `sample=${this.selectedId}`;
      writeHash(hash);
      await navigator.clipboard.writeText(window.location.href);
      this.shareStatus = 'Link copied';
    } catch (e) {
      this.shareStatus =
        e instanceof SyntaxError
          ? 'Fix the JSON before sharing'
          : 'Link is in the address bar';
    }
  };

  onScrub = (event: Event) => {
    this.playground.seek(Number((event.target as HTMLInputElement).value));
  };

  onSpeed = (event: Event) => {
    this.playground.setSpeed(Number((event.target as HTMLSelectElement).value));
  };

  /** User input inside a surface may have changed its data model. */
  onSurfaceInput = () => {
    if (this.#touchQueued) return;
    this.#touchQueued = true;
    requestAnimationFrame(() => {
      this.#touchQueued = false;
      if (!isDestroying(this)) this.playground.touch();
    });
  };

  private onKey(event: KeyboardEvent) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const origin = event.composedPath()[0] ?? event.target;
    if (isEditable(origin)) return;
    if (event.key === ' ') {
      event.preventDefault();
      this.playground.toggle();
    } else if (event.key === 'ArrowRight') {
      this.playground.step();
    } else if (event.key === 'ArrowLeft') {
      this.playground.back();
    }
  }

  <template>
    <div class="explorer">
      <nav class="explorer-sidebar" aria-label="Samples">
        {{#each this.groups as |g|}}
          <h2>{{g.group}}</h2>
          <ul>
            {{#each g.items as |item|}}
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
        {{/each}}
        <p class="sidebar-hint muted">
          <kbd>Space</kbd>
          play/pause ·
          <kbd>←</kbd>
          <kbd>→</kbd>
          step
        </p>
      </nav>

      <main class="stage">
        <header class="stage-header">
          <div>
            <h2 data-test-sample-title>{{this.title}}</h2>
            <p class="muted">{{this.description}}</p>
          </div>
        </header>

        <dl class="stats" data-test-stats>
          {{#each this.stats as |s|}}
            <div>
              <dd>{{s.value}}</dd>
              <dt>{{s.label}} <span>{{s.hint}}</span></dt>
            </div>
          {{/each}}
        </dl>

        <div class="transport" role="group" aria-label="Playback">
          <button
            type="button"
            class="icon-btn"
            title="Restart"
            aria-label="Restart"
            data-test-restart
            {{on "click" this.playground.restart}}
          >⟲</button>
          <button
            type="button"
            class="icon-btn"
            title="Step back"
            aria-label="Step back"
            disabled={{eq this.playground.cursor 0}}
            {{on "click" this.playground.back}}
          >⏮</button>
          <button
            type="button"
            class="icon-btn play"
            aria-label={{if this.playground.playing "Pause" "Play"}}
            data-test-play
            {{on "click" this.playground.toggle}}
          >{{if this.playground.playing "❚❚" "▶"}}</button>
          <button
            type="button"
            class="icon-btn"
            title="Step forward"
            aria-label="Step forward"
            disabled={{this.playground.atEnd}}
            data-test-step
            {{on "click" this.playground.step}}
          >⏭</button>
          <input
            type="range"
            class="scrubber"
            min="0"
            max={{this.playground.total}}
            step="1"
            value={{this.playground.cursor}}
            aria-label="Messages delivered"
            data-test-scrubber
            {{on "input" this.onScrub}}
          />
          <span class="progress" data-test-progress>
            {{this.progressLabel}}
          </span>
          <label class="speed">
            <span class="visually-hidden">Speed</span>
            <select {{on "change" this.onSpeed}}>
              {{#each SPEEDS as |s|}}
                <option
                  value={{s.value}}
                  selected={{eq s.value this.playground.speed}}
                >{{s.label}}</option>
              {{/each}}
            </select>
          </label>
        </div>

        <div class="chat">
          {{#if this.prompt}}
            <div class="turn turn-user">
              <div class="bubble" data-test-prompt>{{this.prompt}}</div>
              <span class="avatar" aria-hidden="true">You</span>
            </div>
          {{/if}}
          <div class="turn turn-agent">
            <span class="avatar" aria-hidden="true">AI</span>
            <div
              class="preview"
              style={{this.previewStyle}}
              data-test-preview
              {{onSurfaceInput this.onSurfaceInput}}
            >
              {{#each this.playground.runs key="id" as |run|}}
                <A2uiSurfaces @session={{run.session}} />
              {{/each}}
              {{#if this.waitingForFirstSurface}}
                <div class="skeleton" aria-label="Waiting for the agent">
                  <span></span><span></span><span></span>
                </div>
              {{/if}}
              {{#if this.playground.thinking}}
                <div class="typing" role="status" data-test-thinking>
                  <span></span><span></span><span></span>
                  Agent is responding
                </div>
              {{/if}}
              {{#if this.playground.error}}
                <p class="error" role="alert" data-test-error>
                  {{this.playground.error}}
                </p>
              {{/if}}
            </div>
          </div>
        </div>
      </main>

      <aside class="inspector" aria-label="Inspector">
        <div class="tabs" role="tablist">
          {{#each this.tabs as |t|}}
            <button
              type="button"
              role="tab"
              aria-selected={{if t.active "true" "false"}}
              data-test-tab={{t.id}}
              {{on "click" (fn this.selectTab t.id)}}
            >
              {{t.label}}
              {{#if t.count}}<span class="count">{{t.count}}</span>{{/if}}
            </button>
          {{/each}}
        </div>

        <div class="inspector-body" role="tabpanel">
          {{#if (eq this.tab "wire")}}
            <p class="muted panel-intro">
              Every message on the wire, in order. Faded ones are still to come;
              open any message to inspect it or rewind the stream to it.
            </p>
            <WireFeed
              @entries={{this.playground.timeline}}
              @onSeek={{this.playground.seek}}
            />
          {{else if (eq this.tab "edit")}}
            <p class="muted panel-intro">
              Edit the agent's messages and apply them, or paste your own.
              <kbd>⌘</kbd><kbd>↵</kbd>
              applies.
            </p>
            <textarea
              class="editor"
              spellcheck="false"
              aria-label="A2UI messages (JSON)"
              data-test-editor
              value={{this.editorText}}
              {{on "input" this.onEdit}}
              {{on "keydown" this.onEditorKey}}
            ></textarea>
            <div class="row">
              <button
                type="button"
                class="btn-primary"
                data-test-apply
                {{on "click" this.apply}}
              >
                Apply
              </button>
              <button type="button" {{on "click" this.format}}>Format</button>
              <button type="button" data-test-share {{on "click" this.share}}>
                Copy share link
              </button>
              {{#if this.shareStatus}}
                <span class="muted" role="status">{{this.shareStatus}}</span>
              {{/if}}
            </div>
            {{#if this.editorError}}
              <p class="error" role="alert" data-test-editor-error>
                {{this.editorError}}
              </p>
            {{/if}}
          {{else}}
            <p class="muted panel-intro">
              Live data model of each surface. Type into a surface and watch it
              change.
            </p>
            {{#each this.playground.dataModels as |m|}}
              <h3>
                Data model ·
                <code>{{m.surfaceId}}</code>
              </h3>
              <JsonBlock @json={{m.json}} data-test-data-model />
            {{else}}
              <p class="muted">No surfaces yet.</p>
            {{/each}}
            <details class="capabilities">
              <summary>Client capabilities sent to the agent</summary>
              <JsonBlock @json={{this.playground.capabilities}} />
            </details>
          {{/if}}
        </div>
      </aside>
    </div>
  </template>
}
