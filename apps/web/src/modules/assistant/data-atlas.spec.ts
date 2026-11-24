import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { it } from 'vitest';

it('rebuilds the physical and product source inventory offline without drift', () => {
  const root = new URL('../../../../../', import.meta.url);
  const requireApi = createRequire(new URL('apps/api/package.json', root));
  execFileSync(
    process.execPath,
    [
      requireApi.resolve('tsx/cli'),
      '--tsconfig',
      'apps/web/tsconfig.json',
      'scripts/operations/nora-agent/build-atlas.ts',
      '--check',
    ],
    { cwd: fileURLToPath(root), timeout: 30000 },
  );
  execFileSync(
    process.execPath,
    ['scripts/operations/nora-agent/check-discovery.mjs'],
    { cwd: fileURLToPath(root), timeout: 10000 },
  );
}, 35000);
