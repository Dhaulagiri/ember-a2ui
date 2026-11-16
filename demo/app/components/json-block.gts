import type { TOC } from '@ember/component/template-only';
import { htmlSafe } from '@ember/template';
import { highlightJson } from '../utils/wire';

// highlightJson escapes all of its input, so the markup is safe.
const highlight = (json: string) => htmlSafe(highlightJson(json));

const JsonBlock: TOC<{ Element: HTMLPreElement; Args: { json: string } }> =
  <template>
    <pre class="json" ...attributes>{{highlight @json}}</pre>
  </template>;

export default JsonBlock;
