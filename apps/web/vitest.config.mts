import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Next preserves JSX for its compiler; component tests must transform it.
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: [
      '**/*.{test,spec}.?(c|m)[jt]s?(x)',
      'src/modules/ticket-catalog/**/*.render.ts',
    ],
  },
});
