import ts from 'typescript';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';

const root = resolve('apps/web/src');
const graph = new Map<string, { imports: string[]; reader: boolean }>();
const resolutions = new Map<string, string | null>();

function sourceFile(base: string) {
  if (!resolutions.has(base)) {
    const candidates = [
      base,
      base + '.ts',
      base + '.tsx',
      resolve(base, 'index.ts'),
      resolve(base, 'index.tsx'),
    ];
    resolutions.set(
      base,
      candidates.find(
        (file) =>
          /\.tsx?$/.test(file) && existsSync(file) && statSync(file).isFile(),
      ) ?? null,
    );
  }
  return resolutions.get(base);
}
function dependencies(file: string) {
  const known = graph.get(file);
  if (known) return known;
  const code = readFileSync(file, 'utf8');
  const imports = new Set<string>();
  for (const { fileName } of ts.preProcessFile(code, true, true)
    .importedFiles) {
    const target = fileName.startsWith('@/')
      ? resolve(root, fileName.slice(2))
      : fileName.startsWith('.')
        ? resolve(dirname(file), fileName)
        : null;
    if (!target || !target.startsWith(root + sep)) continue;
    const found = sourceFile(target);
    if (found) imports.add(found);
  }
  const result = {
    imports: [...imports],
    reader:
      /\b(?:fetch|fetcher|authenticatedFetch|localizedFetch|apiFetch|apiRequest)\s*(?:<[^;\n]+>)?\s*\(/u.test(
        code,
      ),
  };
  graph.set(file, result);
  return result;
}
/** Static import reachability gives maintainers a trace to HTTP clients, not access to their operations. */
export function reachableWebReaders(page: string) {
  const pending = [resolve(page)],
    seen = new Set<string>(),
    readers: string[] = [];
  while (pending.length) {
    const file = pending.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const next = dependencies(file);
    if (next.reader) readers.push(relative('.', file).split(sep).join('/'));
    pending.push(...next.imports);
  }
  return readers.sort();
}
