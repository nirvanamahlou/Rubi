import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { it } from 'vitest';

it('checks the ERP workflow coverage inventory and acceptance gates against current sources', () => {
  const root = new URL('../../../../../', import.meta.url);
  const cwd = fileURLToPath(root);
  const api = createRequire(new URL('apps/api/package.json', root));
  execFileSync(
    process.execPath,
    [
      api.resolve('tsx/cli'),
      '--tsconfig',
      'apps/web/tsconfig.json',
      'scripts/operations/nora-agent/build-workflow-coverage.ts',
      '--check',
    ],
    { cwd, timeout: 20000 },
  );
  execFileSync(
    process.execPath,
    ['--test', 'scripts/operations/nora-agent/grade-role-guides.test.mjs'],
    { cwd, timeout: 10000 },
  );
}, 32000);
