import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    'api-port': { type: 'string', default: '4000' },
    'web-port': { type: 'string', default: '3100' },
    database: { type: 'string' },
    documents: { type: 'string' },
  },
});
try {
  const url = new URL(process.env.DATABASE_URL);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    throw new Error();
  for (const port of [values['api-port'], values['web-port']]) {
    if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)
      throw new Error();
  }
  if (values.database) {
    if (!/^[a-z][a-z0-9_]{0,62}$/.test(values.database)) throw new Error();
    url.pathname = `/${values.database}`;
  }
  if (values.documents) {
    if (!existsSync(values.documents)) throw new Error();
    process.env.DOCUMENTS_STORAGE_ROOT = values.documents;
  }
  process.env.DATABASE_URL = url.toString();
  process.env.API_PORT = values['api-port'];
  process.env.CORS_ORIGINS = [...new Set([values['web-port'], '3100'])]
    .flatMap((port) => [`http://localhost:${port}`, `http://127.0.0.1:${port}`])
    .join(',');
  process.env.NODE_ENV = 'development';
} catch {
  throw new Error(
    'Valid local API configuration is required; environment values are hidden.',
  );
}
process.chdir(fileURLToPath(new URL('../../apps/api', import.meta.url)));
await import(new URL('../../apps/api/dist/main.js', import.meta.url).href);
