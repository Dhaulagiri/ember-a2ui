import Component from '@glimmer/component';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import { htmlSafe } from '@ember/template';
import { BRANDS, theme } from '../utils/theme';
import type { ColorScheme } from '../utils/theme';

const SCHEMES: { id: ColorScheme; label: string }[] = [
  { id: 'system', label: 'Auto' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

const eq = (a: unknown, b: unknown) => a === b;

export default class AppHeader extends Component {
  theme = theme();

  get swatchStyle() {
    return htmlSafe(`--swatch: ${this.theme.brand.swatch}`);
  }

  onBrand = (event: Event) => {
    this.theme.setBrand((event.target as HTMLSelectElement).value);
  };

  <template>
    <header class="app-header">
      <div class="brand">
        <svg class="logo" viewBox="0 0 32 32" aria-hidden="true">
          <rect x="2" y="2" width="28" height="28" rx="8" />
          {{! "e" for Ember, "A" for A2UI }}
          <path
            d="M5.5 17.5 H14.5 A4.5 4.5 0 1 0 13.2 20.7 M18 22 L22 10 L26 22 M19.5 17.5 H24.5"
          />
        </svg>
        <div>
          <h1>ember-a2ui</h1>
          <p class="tagline">
            An Ember renderer for
            <a href="https://a2ui.org">A2UI</a>, the agent-to-UI protocol
          </p>
        </div>
      </div>

      <ul class="badges" aria-label="Highlights">
        <li>A2UI v1.0 · v0.9</li>
        <li>18 / 18 basic components</li>
        <li>Built on @a2ui/web_core</li>
      </ul>

      <nav class="header-links" aria-label="Project links">
        <a href="https://github.com/Dhaulagiri/ember-a2ui">GitHub</a>
        <a href="https://www.npmjs.com/package/ember-a2ui">npm</a>
        <a href="https://a2ui.org/ecosystem/renderers/">Ecosystem</a>
      </nav>

      <div class="theme-controls">
        <div class="segmented" role="group" aria-label="Color scheme">
          {{#each SCHEMES as |s|}}
            <button
              type="button"
              aria-pressed={{if (eq this.theme.scheme s.id) "true" "false"}}
              {{on "click" (fn this.theme.setScheme s.id)}}
            >{{s.label}}</button>
          {{/each}}
        </div>
        <label class="brand-picker">
          <span
            class="swatch"
            style={{this.swatchStyle}}
            aria-hidden="true"
          ></span>
          <span class="visually-hidden">Surface theme</span>
          <select data-test-brand {{on "change" this.onBrand}}>
            {{#each BRANDS as |b|}}
              <option value={{b.id}} selected={{eq b.id this.theme.brandId}}>
                {{b.label}}
              </option>
            {{/each}}
          </select>
        </label>
      </div>
    </header>
  </template>
}
