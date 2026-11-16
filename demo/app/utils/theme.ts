import { tracked } from '@glimmer/tracking';

export type ColorScheme = 'system' | 'light' | 'dark';

export interface Brand {
  id: string;
  label: string;
  /** A swatch color for the picker. */
  swatch: string;
  /** Basic catalog design tokens applied to the preview. */
  tokens: Record<string, string>;
}

/**
 * The basic catalog is styled entirely through `--a2ui-*` custom properties,
 * which inherit into the components' shadow roots. Each brand overrides a
 * handful of them on the preview container.
 */
export const BRANDS: Brand[] = [
  { id: 'default', label: 'A2UI default', swatch: '#1177ee', tokens: {} },
  {
    id: 'ember',
    label: 'Ember',
    swatch: '#e04e39',
    tokens: {
      '--a2ui-color-primary': '#e04e39',
      '--a2ui-border-radius': '0.75rem',
    },
  },
  {
    id: 'grape',
    label: 'Grape, rounded',
    swatch: '#7c4dff',
    tokens: {
      '--a2ui-color-primary': '#7c4dff',
      '--a2ui-border-radius': '1.25rem',
      '--a2ui-grid-base': '0.6rem',
    },
  },
  {
    id: 'forest',
    label: 'Forest, serif',
    swatch: '#2e7d4f',
    tokens: {
      '--a2ui-color-primary': '#2e7d4f',
      '--a2ui-font-family-title': 'Georgia, "Times New Roman", serif',
      '--a2ui-border-radius': '0.4rem',
    },
  },
  {
    id: 'mono',
    label: 'Mono, square',
    swatch: '#555555',
    tokens: {
      '--a2ui-color-primary': 'light-dark(#222, #e8e8e8)',
      '--a2ui-color-on-primary': 'light-dark(#fff, #111)',
      '--a2ui-border-radius': '0',
      '--a2ui-font-family-title': 'ui-monospace, monospace',
    },
  },
];

const STORAGE_KEY = 'ember-a2ui-demo:theme';

function load(): { scheme?: ColorScheme; brand?: string } {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as {
      scheme?: ColorScheme;
      brand?: string;
    };
  } catch {
    return {};
  }
}

class ThemeState {
  @tracked scheme: ColorScheme = 'system';
  @tracked brandId = 'default';

  constructor() {
    const saved = load();
    if (saved.scheme) this.scheme = saved.scheme;
    if (saved.brand && BRANDS.some((b) => b.id === saved.brand)) {
      this.brandId = saved.brand;
    }
    this.#apply();
  }

  get brand(): Brand {
    return BRANDS.find((b) => b.id === this.brandId) ?? (BRANDS[0] as Brand);
  }

  /** Inline style for the preview container. */
  get previewStyle(): string {
    return Object.entries(this.brand.tokens)
      .map(([k, v]) => `${k}: ${v}`)
      .join('; ');
  }

  setScheme = (scheme: ColorScheme) => {
    this.scheme = scheme;
    this.#apply();
    this.#persist();
  };

  setBrand = (id: string) => {
    this.brandId = id;
    this.#persist();
  };

  #apply() {
    const root = document.documentElement;
    root.classList.remove('a2ui-light', 'a2ui-dark');
    if (this.scheme === 'system') {
      delete root.dataset['theme'];
    } else {
      root.dataset['theme'] = this.scheme;
      // The basic catalog's own switch for forcing a scheme.
      root.classList.add(`a2ui-${this.scheme}`);
    }
  }

  #persist() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ scheme: this.scheme, brand: this.brandId }),
      );
    } catch {
      // Storage can be unavailable (private mode); the choice just won't stick.
    }
  }
}

let instance: ThemeState | undefined;

export function theme(): ThemeState {
  return (instance ??= new ThemeState());
}
