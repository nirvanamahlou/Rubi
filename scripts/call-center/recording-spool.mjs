// Offline-ready transport boundary. Only a verified CDR/recording adapter may enqueue.
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'node:crypto';
import {
  mkdir,
  realpath,
  readFile,
  rename,
  unlink,
  readdir,
  lstat,
  open,
} from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readRecording, uploadRecording } from './upload-issabel-recording.mjs';

const jobName = /^[a-f0-9]{64}\.json$/;
async function settings(env) {
  if (!env.ISSABEL_RECORDING_SPOOL_DIRECTORY)
    throw Error('Private spool required.');
  const root = resolve(env.ISSABEL_RECORDING_SPOOL_DIRECTORY);
  const key = Buffer.from(
    env.ISSABEL_RECORDING_SPOOL_KEY_BASE64 ?? '',
    'base64',
  );
  const days = Number(env.ISSABEL_RECORDING_SPOOL_RETENTION_DAYS);
  if (
    key.length !== 32 ||
    key.toString('base64') !== env.ISSABEL_RECORDING_SPOOL_KEY_BASE64 ||
    !Number.isInteger(days) ||
    days < 1 ||
    days > 365
  )
    throw Error('Spool key/retention required.');
  await mkdir(root, { recursive: true, mode: 0o700 });
  if ((await realpath(root)) !== root) throw Error('Spool links forbidden.');
  return { root, key, days };
}
async function exclusive(config, fn) {
  const lock = join(config.root, '.lock');
  // A crash leaves this lock for operator inspection; never steal a live writer's lock.
  await mkdir(lock, { mode: 0o700 });
  try {
    return await fn();
  } finally {
    const { rmdir } = await import('node:fs/promises');
    await rmdir(lock);
  }
}
async function save(config, name, job) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', config.key, iv);
  cipher.setAAD(Buffer.from(name));
  const data = Buffer.concat([
    cipher.update(JSON.stringify(job)),
    cipher.final(),
  ]);
  const temporary = join(config.root, name + '.tmp');
  const file = await open(temporary, 'wx', 0o600);
  try {
    await file.writeFile(
      JSON.stringify({
        iv: iv.toString('base64'),
        tag: cipher.getAuthTag().toString('base64'),
        data: data.toString('base64'),
      }),
    );
    await file.sync();
  } finally {
    await file.close();
  }
  await rename(temporary, join(config.root, name));
}
async function load(config, name) {
  const path = join(config.root, name),
    stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 10000)
    throw Error('Invalid spool file.');
  const value = JSON.parse(await readFile(path, 'utf8'));
  const decipher = createDecipheriv(
    'aes-256-gcm',
    config.key,
    Buffer.from(value.iv, 'base64'),
  );
  decipher.setAAD(Buffer.from(name));
  decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(value.data, 'base64')),
      decipher.final(),
    ]).toString(),
  );
}
export async function enqueueRecording(input, env = process.env) {
  if (
    input?.version !== 1 ||
    input.finalized !== true ||
    !/^[A-Za-z0-9_.:-]{1,128}$/.test(input.rootCallId ?? '') ||
    !/^[A-Za-z0-9_.:-]{1,128}$/.test(input.externalCallId ?? '') ||
    !['IN', 'OUT'].includes(input.direction)
  )
    throw Error('Verified finalized recording manifest v1 required.');
  const config = await settings(env);
  const { sha256 } = await readRecording(input.file, env);
  const source = {
    file: input.file,
    rootCallId: input.rootCallId,
    externalCallId: input.externalCallId,
    direction: input.direction,
    expectedSha256: sha256,
  };
  const name =
    createHmac('sha256', config.key)
      .update(
        JSON.stringify([source.rootCallId, source.externalCallId, source.file]),
      )
      .digest('hex') + '.json';
  return exclusive(config, async () => {
    const names = await readdir(config.root);
    if (names.includes(name)) {
      const prior = await load(config, name);
      if (JSON.stringify(prior.source) !== JSON.stringify(source))
        throw Error('Recording identity conflict.');
      return { duplicate: true, state: prior.state };
    }
    if (names.filter((n) => jobName.test(n)).length >= 10000)
      throw Error('Spool full; retain source.');
    await save(config, name, {
      source,
      state: 'pending',
      attempts: 0,
      nextAt: 0,
      expiresAt: Date.now() + config.days * 86400000,
    });
    return { duplicate: false, state: 'pending' };
  });
}
export async function flushRecordings(
  env = process.env,
  upload = uploadRecording,
) {
  const config = await settings(env);
  return exclusive(config, async () => {
    const result = { sent: 0, pending: 0, rejected: 0, expired: 0 };
    let attempted = 0;
    for (const name of (await readdir(config.root))
      .filter((n) => jobName.test(n))
      .sort()) {
      const job = await load(config, name);
      if (!Number.isFinite(job.expiresAt))
        throw Error('Invalid retention deadline.');
      if (job.expiresAt <= Date.now()) {
        await unlink(join(config.root, name));
        result.expired++;
        continue;
      }
      if (job.state === 'done') continue;
      if (job.state === 'review') {
        result.rejected++;
        continue;
      }
      if (job.nextAt > Date.now() || attempted >= 20) {
        result.pending++;
        continue;
      }
      attempted++;
      try {
        // Detect replaced/changed source before any network operation or correlation.
        const current = await readRecording(job.source.file, env);
        if (current.sha256 !== job.source.expectedSha256) {
          job.state = 'review';
          result.rejected++;
        } else {
          await upload(job.source, env);
          job.state = 'done';
          result.sent++;
        }
      } catch (error) {
        job.attempts++;
        if (
          [400, 409, 413, 415, 422].includes(error.status) ||
          job.attempts >= 8
        ) {
          job.state = 'review';
          result.rejected++;
        } else {
          job.nextAt =
            Date.now() +
            Math.min(3600000, 30000 * 2 ** job.attempts) +
            Math.floor(Math.random() * 5000);
          result.pending++;
        }
      }
      // Crash after upload is safe: uploader replays identical recording/chunks.
      await save(config, name, job);
    }
    return result;
  });
}
export async function retryRecording(name, env = process.env) {
  if (!jobName.test(name)) throw Error('Opaque spool ID required.');
  const config = await settings(env);
  return exclusive(config, async () => {
    const job = await load(config, name);
    if (job.state !== 'review' || job.expiresAt <= Date.now())
      throw Error('Job is not retryable.');
    const current = await readRecording(job.source.file, env);
    if (current.sha256 !== job.source.expectedSha256)
      throw Error('Source changed; cannot retry.');
    job.lastRetriedAt = new Date().toISOString();
    job.retryCount = (job.retryCount ?? 0) + 1;
    job.attempts = 0;
    job.nextAt = 0;
    job.state = 'pending';
    await save(config, name, job);
    return { state: 'pending' };
  });
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
        if (Buffer.byteLength(input) > 4096) throw Error('Manifest too large.');
      }
      console.log(JSON.stringify(await enqueueRecording(JSON.parse(input))));
    } else if (process.argv[2] === 'flush') {
      const result = await flushRecordings();
      console.log(JSON.stringify(result));
      if (result.pending || result.rejected) process.exitCode = 2;
    } else if (process.argv[2] === 'retry')
      console.log(JSON.stringify(await retryRecording(process.argv[3])));
    else throw Error('Use enqueue, flush or retry.');
  } catch {
    console.error(
      'Recording spool unavailable; inspect private configuration/lock and retained source.',
    );
    process.exitCode = 1;
  }
}
