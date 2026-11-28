// Read-only baseline check. Compare source in the four running artifacts to a reviewed
// Git tree. Only paths, Git object digests and result counts cross the SSH connection.
import { execFileSync } from 'node:child_process';

const revision = process.argv[2];
if (!/^[a-f0-9]{40}$/u.test(revision ?? ''))
  throw new Error('Pass the full pre-release Git baseline SHA.');
const host = process.argv[3] ?? 'rubi-erp';
if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]{0,127}$/u.test(host))
  throw new Error('Expected SSH config alias.');
const packages = [
  'packages/contracts/src',
  'packages/database/prisma/schema.prisma',
];
const units = [
  ['rubi-production-api-1', ['apps/api/src', ...packages]],
  ['rubi-production-web-1', ['apps/web/src', ...packages]],
  ['rubi-nora-assistant-read', ['apps/api/src', ...packages]],
  ['rubi-nora-assistant', ['services/assistant']],
];

// Standalone function executed by Node INSIDE the unit, without its environment.
async function compareSource(unit, directories, wanted) {
  const { readFileSync, readdirSync, lstatSync } = await import('node:fs');
  const { createHash } = await import('node:crypto');
  const { join } = await import('node:path');
  const expected = new Map(wanted);
  const liveOnly = [],
    changed = [],
    missing = [];
  const included = (path) =>
    /\.(?:[cm]?[jt]sx?|json|css|prisma)$/u.test(path) &&
    !/\.(?:test|spec|e2e-spec)\.[cm]?[jt]sx?$/u.test(path) &&
    !/(?:^|\/)(?:__tests__|node_modules|dist)(?:\/|$)/u.test(path);
  for (const root of directories) {
    const path =
      unit === 'rubi-nora-assistant' ? '/nora-source' : '/workspace/' + root;
    function visit(absolute, relative) {
      const info = lstatSync(absolute, { throwIfNoEntry: false });
      if (!info) return;
      if (info.isDirectory()) {
        for (const entry of readdirSync(absolute, { withFileTypes: true }))
          if (
            !['node_modules', 'dist', '__tests__', '.git'].includes(entry.name)
          )
            visit(join(absolute, entry.name), relative + '/' + entry.name);
      } else if (info.isFile() && included(relative)) {
        if (!expected.has(relative)) {
          liveOnly.push(relative);
          return;
        }
        const bytes = Buffer.from(
          readFileSync(absolute, 'utf8').replace(/\r\n/gu, '\n'),
        );
        const hash = createHash('sha1')
          .update('blob ' + bytes.length + '\0')
          .update(bytes)
          .digest('hex');
        if (hash !== expected.get(relative)) changed.push(relative);
        expected.delete(relative);
      }
    }
    visit(path, root);
  }
  for (const path of expected.keys()) if (included(path)) missing.push(path);
  return { unit, changed, liveOnly, missing };
}

for (const [unit, directories] of units) {
  const files = execFileSync(
    'git',
    ['ls-tree', '-r', '-z', revision, '--', ...directories],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  )
    .split('\0')
    .filter(Boolean)
    .map((line) => {
      const [header, path] = line.split('\t');
      return [path, header.split(' ')[2]];
    });
  const source =
    'const compareSource = ' +
    compareSource.toString() +
    ';\n' +
    'console.log(JSON.stringify(await compareSource(' +
    [unit, directories, files].map((x) => JSON.stringify(x)).join(',') +
    ')));';
  const result = JSON.parse(
    execFileSync(
      'ssh',
      [
        '-o',
        'BatchMode=yes',
        '-o',
        'ConnectTimeout=8',
        host,
        'docker',
        'exec',
        '-i',
        unit,
        'node',
        '--input-type=module',
      ],
      {
        input: source,
        encoding: 'utf8',
        timeout: 90000,
        maxBuffer: 16 * 1024 * 1024,
      },
    ),
  );
  console.log(JSON.stringify({ revision, ...result }));
  if (result.changed.length || result.liveOnly.length || result.missing.length)
    process.exitCode = 1;
}
