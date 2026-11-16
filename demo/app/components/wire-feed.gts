import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import { modifier } from 'ember-modifier';
import JsonBlock from './json-block';
import { formatBytes } from '../utils/wire';
import type { WireEntry } from '../utils/playground';

interface WireFeedSignature {
  Args: {
    entries: WireEntry[];
    /** Rebuild the session with the first `count` scripted messages. */
    onSeek: (count: number) => void;
  };
}

/** Keeps the newest delivered message in view inside the scrolling panel. */
const followLatest = modifier((element: HTMLElement, [count]: [number]) => {
  void count;
  const delivered = element.querySelectorAll('[data-delivered]');
  const latest = delivered[delivered.length - 1] as HTMLElement | undefined;
  const panel = element.closest('.inspector-body');
  if (!latest || !panel) return;
  const top = latest.offsetTop - panel.clientHeight / 3;
  panel.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
});

const ORIGIN_LABEL: Record<WireEntry['origin'], string> = {
  script: 'agent',
  agent: 'agent reply',
  client: 'client',
};

const originLabel = (origin: WireEntry['origin']) => ORIGIN_LABEL[origin];
const seekTarget = (entry: WireEntry) => entry.scriptIndex + 1;
const isScripted = (entry: WireEntry) => entry.scriptIndex >= 0;

export default class WireFeed extends Component<WireFeedSignature> {
  /** Keys of the entries whose JSON is shown. */
  @tracked open: string[] = [];

  isOpen = (entry: WireEntry) => this.open.includes(entry.key);

  toggle = (entry: WireEntry) => {
    this.open = this.isOpen(entry)
      ? this.open.filter((k) => k !== entry.key)
      : [...this.open, entry.key];
  };

  get deliveredCount() {
    return this.args.entries.filter((e) => !e.pending).length;
  }

  <template>
    <ol class="wire" data-test-wire {{followLatest this.deliveredCount}}>
      {{#each @entries key="key" as |entry|}}
        <li
          class="wire-entry wire-{{entry.dir}}
            wire-{{entry.origin}}
            {{if entry.pending 'is-pending'}}"
          data-delivered={{unless entry.pending "true"}}
          data-test-wire-entry={{entry.summary.kind}}
        >
          <button
            type="button"
            class="wire-toggle"
            aria-expanded={{if (this.isOpen entry) "true" "false"}}
            {{on "click" (fn this.toggle entry)}}
          >
            <span class="wire-dir" aria-hidden="true">
              {{if (isDown entry) "↓" "↑"}}
            </span>
            <span class="wire-kind">{{entry.summary.kind}}</span>
            <span class="wire-detail">{{entry.summary.detail}}</span>
            <span class="wire-meta">
              {{originLabel entry.origin}}
              ·
              {{formatBytes entry.bytes}}
            </span>
          </button>
          {{#if (this.isOpen entry)}}
            <div class="wire-body">
              <div class="wire-actions">
                <span class="muted">
                  {{#if entry.summary.surfaceId}}
                    surface
                    <code>{{entry.summary.surfaceId}}</code>
                  {{/if}}
                  {{#if entry.time}}· {{entry.time}}{{/if}}
                </span>
                {{#if (isScripted entry)}}
                  <button
                    type="button"
                    class="btn-small"
                    {{on "click" (fn @onSeek (seekTarget entry))}}
                  >
                    {{if entry.pending "Jump to here" "Rewind to here"}}
                  </button>
                {{/if}}
              </div>
              <JsonBlock @json={{entry.json}} />
            </div>
          {{/if}}
        </li>
      {{/each}}
    </ol>
  </template>
}

function isDown(entry: WireEntry) {
  return entry.dir === 'down';
}
