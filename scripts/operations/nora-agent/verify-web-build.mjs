import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Run on the fresh Web build BEFORE retaining old hashed assets. */
export function verifyAgentWebBuild(staticDirectory) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && path.endsWith('.js')) files.push(path);
    }
  };
  visit(staticDirectory);
  const composers = files
    .map((path) => readFileSync(path, 'utf8'))
    .filter((source) => source.includes('/api/assistant/v3/conversation'));
  if (!composers.length) throw new Error('NORA_AGENT_COMPOSER_MISSING');
  for (const source of composers) {
    if (
      source.includes('NEXT_PUBLIC_ASSISTANT_AGENT_ENABLED') ||
      !/agentMode\s*:\s*(?:!0|true)\b/.test(source)
    )
      throw new Error('NORA_AGENT_BUILD_FLAG_NOT_INLINED_TRUE');
  }
  return { agentComposers: composers.length, enabled: true };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    console.log(
      JSON.stringify(
        verifyAgentWebBuild(process.argv[2] ?? 'apps/web/.next/static'),
      ),
    );
  } catch (error) {
    console.error(
      error.code === 'ENOENT' ? 'NORA_WEB_BUILD_MISSING' : error.message,
    );
    process.exitCode = 1;
  }
}
