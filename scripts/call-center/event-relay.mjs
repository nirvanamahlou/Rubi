// Provider-neutral durable publisher. A verified PBX-side adapter must supply v1 facts.
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'node:crypto';
import {
  mkdir,
  open,
  readdir,
  realpath,
  link,
  unlink,
  rename,
  lstat,
} from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const canonical = (value) =>
  value && typeof value === 'object'
    ? Array.isArray(value)
      ? value.map(canonical)
      : Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]),
        )
    : value;
const filePattern = /^[a-f0-9]{64}\.json$/;
async function settings(env) {
  if (!env.TELEPHONY_SPOOL_DIRECTORY) throw Error('Spool directory required.');
  const key = Buffer.from(env.TELEPHONY_SPOOL_KEY_BASE64 ?? '', 'base64');
  const days = Number(env.TELEPHONY_SPOOL_RETENTION_DAYS);
  if (
    key.length !== 32 ||
    key.toString('base64') !== env.TELEPHONY_SPOOL_KEY_BASE64 ||
    !Number.isInteger(days) ||
    days < 1 ||
    days > 365
  )
    throw Error('Spool key/retention required.');
  const root = resolve(env.TELEPHONY_SPOOL_DIRECTORY);
  await mkdir(root, { recursive: true, mode: 0o700 });
  if ((await realpath(root)).toLowerCase() !== root.toLowerCase())
    throw Error('Spool links are not allowed.');
  return { root, key, days };
}
async function readFile(path) {
  if ((await realpath(path)).toLowerCase() !== resolve(path).toLowerCase())
    throw Error('Spool record links are not allowed.');
  const handle = await open(path, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 25000)
      throw Error('Invalid spool record.');
    return JSON.parse(await handle.readFile('utf8'));
  } finally {
    await handle.close();
  }
}
function decode(record, key, name) {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(record.iv, 'base64'),
  );
  decipher.setAAD(Buffer.from(name));
  decipher.setAuthTag(Buffer.from(record.tag, 'base64'));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(record.data, 'base64')),
      decipher.final(),
    ]).toString(),
  );
}
export async function enqueue(event, env = process.env) {
  const { root, key, days } = await settings(env);
  const payload = JSON.stringify(canonical(event));
  if (
    Buffer.byteLength(payload ?? '') > 16384 ||
    !event ||
    event.schemaVersion !== 1 ||
    event.connectionId !== env.TELEPHONY_RELAY_CONNECTION_ID ||
    typeof event.externalEventId !== 'string' ||
    !event.externalEventId ||
    event.externalEventId.length > 128
  )
    throw Error('Canonical event v1 required.');
  const name =
    createHmac('sha256', key)
      .update(JSON.stringify([event.connectionId, event.externalEventId]))
      .digest('hex') + '.json';
  const names = await readdir(root);
  const verify = async (file) => {
    const prior = decode(await readFile(join(root, file)), key, name);
    if (JSON.stringify(canonical(prior.event)) !== payload)
      throw Error('Spool event identity conflict.');
    return { queued: true, duplicate: true };
  };
  if (names.includes(name)) return verify(name);
  if (names.includes(name + '.dead'))
    throw Error('Event requires operator review.');
  if (
    names.filter((n) => filePattern.test(n) || n.endsWith('.dead')).length >=
    10000
  )
    throw Error('Spool capacity reached; source must retain the event.');
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(name));
  const data = Buffer.concat([
    cipher.update(
      JSON.stringify({ event, expiresAt: Date.now() + days * 86400000 }),
    ),
    cipher.final(),
  ]);
  const record = JSON.stringify({
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64'),
  });
  const temp = join(root, name + '.' + randomBytes(8).toString('hex') + '.tmp');
  const handle = await open(temp, 'wx', 0o600);
  try {
    await handle.writeFile(record);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    // Atomic no-replace publication; a half-written event is never a deliverable file.
    await link(temp, join(root, name));
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    return await verify(name);
  } finally {
    await unlink(temp);
  }
  return { queued: true, duplicate: false };
}
export async function flush(env = process.env, send = fetch) {
  const { root, key } = await settings(env);
  for (const name of (await readdir(root)).filter((n) =>
    /^[a-f0-9]{64}\.json\.[a-f0-9]{16}\.tmp$/.test(n),
  )) {
    const path = join(root, name),
      stat = await lstat(path);
    if (stat.isFile() && stat.mtimeMs < Date.now() - 86400000)
      await unlink(path);
  }
  const url = new URL(env.TELEPHONY_RELAY_API_URL ?? '');
  if (
    (url.protocol !== 'https:' &&
      !(
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      )) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.pathname.endsWith('/internal/telephony-relay/events')
  )
    throw Error('Private HTTPS or loopback relay URL required.');
  const secret = env.TELEPHONY_RELAY_SECRET;
  if (!secret || secret.length < 32)
    throw Error('Separate relay credential required.');
  const names = (await readdir(root))
    .filter((name) => filePattern.test(name))
    .sort()
    .slice(0, 50);
  const result = { sent: 0, rejected: 0, pending: 0 };
  for (const name of names) {
    let record;
    try {
      record = decode(await readFile(join(root, name)), key, name);
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw Error('Spool integrity failure; retained for review.');
    }
    if (!Number.isFinite(record.expiresAt) || record.expiresAt <= Date.now()) {
      // Expired private data is deleted under the explicitly configured retention policy.
      await unlink(join(root, name)).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
      result.rejected++;
      continue;
    }
    let response;
    try {
      response = await send(url, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
        headers: {
          authorization: `Bearer ${secret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(record.event),
      });
    } catch {
      result.pending++;
      break;
    }
    if (response.ok) {
      const receipt = await response.json();
      if (
        !/^[0-9a-f-]{36}$/i.test(receipt?.id ?? '') ||
        typeof receipt.duplicate !== 'boolean'
      )
        throw Error('Invalid durable receipt; event retained.');
      await unlink(join(root, name)).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
      result.sent++;
    } else {
      await response.body?.cancel();
      if ([400, 409, 422].includes(response.status)) {
        await rename(join(root, name), join(root, name + '.dead')).catch(
          (error) => {
            if (error.code !== 'ENOENT') throw error;
          },
        );
        result.rejected++;
      } else {
        result.pending++;
        break;
      }
    }
  }
  // Apply the same private retention deadline to quarantined events.
  for (const name of (await readdir(root))
    .filter((n) => /^[a-f0-9]{64}\.json\.dead$/.test(n))
    .slice(0, 10000)) {
    const record = decode(
      await readFile(join(root, name)),
      key,
      name.slice(0, -5),
    );
    if (record.expiresAt <= Date.now()) await unlink(join(root, name));
  }
  return result;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    if (process.argv[2] === 'enqueue') {
      let input = '';
      for await (const chunk of process.stdin) {
        input += chunk;
        if (Buffer.byteLength(input) > 16384) throw Error('Event too large.');
      }
      console.log(JSON.stringify(await enqueue(JSON.parse(input))));
    } else if (process.argv[2] === 'flush') {
      const result = await flush();
      console.log(JSON.stringify(result));
      if (result.pending || result.rejected) process.exitCode = 2;
    } else throw Error('Use enqueue (canonical JSON on stdin) or flush.');
  } catch {
    console.error(
      'Relay failed; inspect configuration or retained spool securely.',
    );
    process.exitCode = 1;
  }
}
