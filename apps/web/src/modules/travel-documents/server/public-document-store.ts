import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

const tokenPattern = /^[A-Za-z0-9_-]{32}$/;
const maximum = 10_000_000;
const magic = Buffer.from('NTD1');
type Settings = { origin: string; root: string; key: Buffer };
export type PublicDocumentDraft = {
  url: string;
  save: (html: string) => Promise<void>;
};
export function publicDocumentSettings(
  env: Readonly<Record<string, string | undefined>> = process.env,
): Settings | undefined {
  const origin = env.PUBLIC_TRAVEL_DOCUMENTS_ORIGIN;
  const root = env.PUBLIC_TRAVEL_DOCUMENTS_ROOT;
  const key = env.PUBLIC_TRAVEL_DOCUMENTS_KEY;
  if (!origin && !root && !key) return undefined;
  if (
    !origin ||
    !root ||
    !key ||
    !/^[a-f0-9]{64}$/i.test(key) ||
    !isAbsolute(root)
  )
    throw new Error('PUBLIC_DOCUMENT_CONFIGURATION');
  const url = new URL(origin);
  if (
    url.origin !== origin ||
    url.username ||
    url.password ||
    !(
      url.protocol === 'https:' ||
      (url.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(url.hostname))
    )
  )
    throw new Error('PUBLIC_DOCUMENT_CONFIGURATION');
  if ((origin + '/d/' + 'a'.repeat(32)).length > 78)
    throw new Error('PUBLIC_DOCUMENT_CONFIGURATION');
  return { origin, root, key: Buffer.from(key, 'hex') };
}
function file(settings: Settings, token: string) {
  return join(
    settings.root,
    createHash('sha256').update(token).digest('hex') + '.bin',
  );
}
/** Only trusted, authorized document route renderers call this writer; browsers never upload HTML. */
export function createPublicDocument(
  env: Readonly<Record<string, string | undefined>> = process.env,
): PublicDocumentDraft | undefined {
  const settings = publicDocumentSettings(env);
  if (!settings) return undefined;
  const token = randomBytes(24).toString('base64url');
  const url = settings.origin + '/d/' + token;
  return {
    url,
    save: async (html: string) => {
      const bytes = Buffer.from(html, 'utf8');
      if (!html.startsWith('<!doctype html>') || bytes.length > maximum)
        throw new Error('PUBLIC_DOCUMENT_SIZE');
      const nonce = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', settings.key, nonce);
      cipher.setAAD(Buffer.from(token));
      const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
      await mkdir(settings.root, { recursive: true, mode: 0o700 });
      // Exclusive single write: a reader sees either an absent file or an authenticated complete artifact.
      await writeFile(
        file(settings, token),
        Buffer.concat([magic, nonce, cipher.getAuthTag(), encrypted]),
        { flag: 'wx', mode: 0o600 },
      );
    },
  };
}
export async function readPublicDocument(
  token: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<string | undefined> {
  if (!tokenPattern.test(token)) return undefined;
  const settings = publicDocumentSettings(env);
  if (!settings) return undefined;
  try {
    const path = file(settings, token);
    const info = await stat(path);
    if (!info.isFile() || info.size > maximum + 32 || info.size < 32)
      return undefined;
    const bytes = await readFile(path);
    if (!bytes.subarray(0, 4).equals(magic)) return undefined;
    const decipher = createDecipheriv(
      'aes-256-gcm',
      settings.key,
      bytes.subarray(4, 16),
    );
    decipher.setAAD(Buffer.from(token));
    decipher.setAuthTag(bytes.subarray(16, 32));
    return Buffer.concat([
      decipher.update(bytes.subarray(32)),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return undefined;
  }
}
