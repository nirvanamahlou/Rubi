import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  enqueueRecording,
  flushRecordings,
  retryRecording,
} from './recording-spool.mjs';
import { readRecording } from './upload-issabel-recording.mjs';

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'rubi-audio-'));
  const recordings = join(root, 'recordings'),
    spool = join(root, 'spool');
  await mkdir(join(recordings, '2026', '10', '24'), { recursive: true });
  const audio = Buffer.alloc(100, 2);
  audio.write('RIFF');
  audio.writeUInt32LE(92, 4);
  audio.write('WAVE', 8);
  const file = '2026/10/24/synthetic.wav';
  await writeFile(join(recordings, file), audio);
  const env = {
    ISSABEL_RECORDING_DIRECTORY: recordings,
    ISSABEL_RECORDING_SPOOL_DIRECTORY: spool,
    ISSABEL_RECORDING_SPOOL_KEY_BASE64: Buffer.alloc(32, 3).toString('base64'),
    ISSABEL_RECORDING_SPOOL_RETENTION_DAYS: '7',
  };
  const manifest = {
    version: 1,
    finalized: true,
    file,
    rootCallId: 'test.123',
    externalCallId: 'test.456',
    direction: 'IN',
  };
  try {
    await run({ root, recordings, spool, audio, file, env, manifest });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
test('encrypted durable manifest, exact nested WAV bytes, duplicate and restart receipt', () =>
  fixture(async ({ env, manifest, spool, audio }) => {
    assert.equal((await enqueueRecording(manifest, env)).duplicate, false);
    const names = await readdir(spool);
    assert.equal(names.length, 1);
    const raw = await readFile(join(spool, names[0]), 'utf8');
    assert.ok(!raw.includes(manifest.file));
    assert.ok(!raw.includes(manifest.rootCallId));
    let uploads = 0;
    const result = await flushRecordings(env, async (source) => {
      uploads++;
      assert.equal(source.rootCallId, manifest.rootCallId);
      assert.deepEqual((await readRecording(source.file, env)).audio, audio);
    });
    assert.equal(result.sent, 1);
    assert.equal((await enqueueRecording(manifest, env)).duplicate, true);
    assert.equal(
      (
        await flushRecordings(env, async () => {
          uploads++;
        })
      ).sent,
      0,
    );
    assert.equal(uploads, 1);
  }));
test('outage retains job with backoff; no repeated busy polling', () =>
  fixture(async ({ env, manifest, spool }) => {
    await enqueueRecording(manifest, env);
    let attempts = 0;
    assert.equal(
      (
        await flushRecordings(env, async () => {
          attempts++;
          throw Error('offline');
        })
      ).pending,
      1,
    );
    assert.equal(
      (
        await flushRecordings(env, async () => {
          attempts++;
        })
      ).pending,
      1,
    );
    assert.equal(attempts, 1);
    assert.equal((await readdir(spool)).length, 1);
  }));
test('permanent failure quarantined; explicit retry retains identity', () =>
  fixture(async ({ env, manifest, spool }) => {
    await enqueueRecording(manifest, env);
    assert.equal(
      (
        await flushRecordings(env, async () => {
          throw Object.assign(Error('conflict'), { status: 409 });
        })
      ).rejected,
      1,
    );
    const name = (await readdir(spool))[0];
    await retryRecording(name, env);
    assert.equal((await flushRecordings(env, async () => {})).sent, 1);
  }));
test('changed file never uploads as a different recording; identity cannot be overwritten', () =>
  fixture(async ({ env, manifest, recordings, audio }) => {
    await enqueueRecording(manifest, env);
    audio[99] = 8;
    await writeFile(join(recordings, manifest.file), audio);
    let uploaded = false;
    assert.equal(
      (
        await flushRecordings(env, async () => {
          uploaded = true;
        })
      ).rejected,
      1,
    );
    assert.equal(uploaded, false);
    await assert.rejects(enqueueRecording(manifest, env), /conflict/);
  }));
test('unfinalized, traversal, malformed WAV, absent directory rejected', () =>
  fixture(async ({ env, manifest, recordings }) => {
    await assert.rejects(
      enqueueRecording({ ...manifest, finalized: false }, env),
    );
    for (const file of [
      '../bad.wav',
      '/bad.wav',
      'a/../../bad.wav',
      'a\\bad.wav',
      'https://bad.wav',
    ])
      await assert.rejects(readRecording(file, env));
    await assert.rejects(readRecording(manifest.file, {}));
    await writeFile(join(recordings, manifest.file), Buffer.alloc(100));
    await assert.rejects(enqueueRecording(manifest, env));
  }));
test('tampered encrypted job and concurrent/stale lock fail closed', () =>
  fixture(async ({ env, manifest, spool }) => {
    await enqueueRecording(manifest, env);
    await mkdir(join(spool, '.lock'));
    await assert.rejects(flushRecordings(env));
    await rm(join(spool, '.lock'), { recursive: true });
    const name = (await readdir(spool))[0];
    await writeFile(join(spool, name), '{}');
    await assert.rejects(flushRecordings(env));
    assert.ok((await readdir(spool)).includes(name));
  }));
