import { defineConfig } from 'vite';
import { extensions, classicEmberSupport, ember } from '@embroider/vite';
import { babel } from '@rollup/plugin-babel';

export default defineConfig({
  base: process.env.DEMO_BASE ?? '/',
  plugins: [
    classicEmberSupport(),
    ember(),
    // extra plugins here
    babel({
      babelHelpers: 'runtime',
      extensions,
      // @a2ui/web_core imports JSON schemas; keep Babel off them in the dep optimizer.
      exclude: [/\.json(\?.*)?$/],
    }),
  ],
});
