import {
  openSync,
  closeSync,
  fstatSync,
  readFileSync,
  constants,
} from 'node:fs';
import { isAbsolute } from 'node:path';

const invalid = () => {
  throw new Error('GROQ_POOL_CONFIGURATION_INVALID');
};
const identifier = (v) =>
  typeof v === 'string' && /^[a-z][a-z0-9-]{0,39}$/.test(v);
const plain = (v) => v && Object.getPrototypeOf(v) === Object.prototype;
export function validateGroqCredentials(value) {
  if (
    !plain(value) ||
    value.version !== 1 ||
    Object.keys(value).some((k) => !['version', 'keys'].includes(k)) ||
    !Array.isArray(value.keys) ||
    !value.keys.length ||
    value.keys.length > 32
  )
    invalid();
  const ids = new Set(),
    secrets = new Set(),
    entries = [];
  for (const item of value.keys) {
    if (
      !plain(item) ||
      Object.keys(item).some(
        (k) =>
          !['id', 'apiKey', 'organization', 'project', 'enabled'].includes(k),
      ) ||
      !identifier(item.id) ||
      !identifier(item.organization) ||
      (item.project !== undefined && !identifier(item.project)) ||
      (item.enabled !== undefined && typeof item.enabled !== 'boolean') ||
      typeof item.apiKey !== 'string' ||
      !item.apiKey ||
      item.apiKey.length > 512 ||
      /\s/.test(item.apiKey) ||
      ids.has(item.id)
    )
      invalid();
    ids.add(item.id);
    if (secrets.has(item.apiKey)) continue;
    secrets.add(item.apiKey);
    entries.push(Object.freeze({ ...item, enabled: item.enabled !== false }));
  }
  if (!entries.some((k) => k.enabled)) invalid();
  return Object.freeze(entries);
}

/** Error messages never include JSON parser details, paths or credential values. */
export function readGroqCredentials(env = process.env) {
  if (env.GROQ_KEY_POOL_FILE !== undefined) {
    const path = env.GROQ_KEY_POOL_FILE;
    if (typeof path !== 'string' || !isAbsolute(path)) invalid();
    let fd;
    try {
      fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      const stat = fstatSync(fd);
      if (
        !stat.isFile() ||
        stat.size > 32768 ||
        (process.platform !== 'win32' && stat.mode & 0o077)
      )
        invalid();
      return validateGroqCredentials(JSON.parse(readFileSync(fd, 'utf8')));
    } catch {
      invalid();
    } finally {
      if (fd !== undefined) closeSync(fd);
    }
  }
  return validateGroqCredentials({
    version: 1,
    keys: [
      {
        id: 'groq-primary',
        organization: 'groq-main',
        apiKey: env.GROQ_API_KEY,
      },
    ],
  });
}
