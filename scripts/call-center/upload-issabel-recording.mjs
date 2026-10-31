// Run on a trusted PBX-side machine only after StopMixMonitor has closed the file.
import { createHash } from 'node:crypto';
import { open, realpath, lstat } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function readRecording(file, env = process.env) {
  if (
    typeof file !== 'string' ||
    file.length > 512 ||
    !file
      .split('/')
      .every((part) => /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(part)) ||
    !file.endsWith('.wav')
  )
    throw Error('Invalid relative WAV path.');
  if (!env.ISSABEL_RECORDING_DIRECTORY)
    throw Error('Recording directory required.');
  const root = await realpath(env.ISSABEL_RECORDING_DIRECTORY);
  let path = root;
  for (const part of file.split('/')) {
    path = resolve(path, part);
    if ((await lstat(path)).isSymbolicLink())
      throw Error('Recording links are not allowed.');
  }
  const canonical = await realpath(path);
  const rel = relative(root, canonical);
  if (rel.startsWith('..') || isAbsolute(rel))
    throw Error('Recording outside approved directory.');
  const handle = await open(canonical, 'r');
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.size < 44 || before.size > 20971520)
      throw Error('Recording size is unsupported.');
    const audio = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < audio.length) {
      const part = await handle.read(
        audio,
        offset,
        audio.length - offset,
        offset,
      );
      if (!part.bytesRead) throw Error('Recording was truncated.');
      offset += part.bytesRead;
    }
    const after = await handle.stat();
    if (
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs ||
      before.ctimeMs !== after.ctimeMs
    )
      throw Error('Recording is not finalized.');
    if (
      audio.toString('ascii', 0, 4) !== 'RIFF' ||
      audio.toString('ascii', 8, 12) !== 'WAVE' ||
      audio.readUInt32LE(4) !== audio.length - 8
    )
      throw Error('Finalized RIFF WAV recording required.');
    return { audio, sha256: createHash('sha256').update(audio).digest('hex') };
  } finally {
    await handle.close();
  }
}

export async function uploadRecording(
  { file, rootCallId, externalCallId, direction, expectedSha256 },
  env = process.env,
) {
  if (
    !/^[A-Za-z0-9_.:-]{1,128}$/.test(rootCallId ?? '') ||
    !/^[A-Za-z0-9_.:-]{1,128}$/.test(externalCallId ?? '') ||
    !['IN', 'OUT'].includes(direction)
  )
    throw Error('Invalid recording arguments.');
  const url = new URL(env.ISSABEL_RECORDING_API_URL ?? '');
  if (
    (url.protocol !== 'https:' &&
      !(
        url.protocol === 'http:' &&
        ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      )) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw Error('HTTPS or loopback is required.');
  const token = env.ISSABEL_RECORDING_UPLOAD_SECRET;
  if (!token || token.length < 32)
    throw Error('Private recording credential is required.');
  const { audio, sha256 } = await readRecording(file, env);
  if (expectedSha256 && sha256 !== expectedSha256)
    throw Error('Recording content changed.');
  const identity = createHash('sha256')
    .update(JSON.stringify([rootCallId, externalCallId, direction, sha256]))
    .digest('hex');
  // Stable v8 UUID makes a restarted upload replay the same recording.
  const id = `${identity.slice(0, 8)}-${identity.slice(8, 12)}-8${identity.slice(13, 16)}-a${identity.slice(17, 20)}-${identity.slice(20, 32)}`;
  async function post(path, body = {}) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(
          `${url.toString().replace(/\/$/, '')}${path}`,
          {
            method: 'POST',
            redirect: 'error',
            signal: AbortSignal.timeout(15000),
            headers: {
              authorization: `Bearer ${token}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify(body),
          },
        );
        if (response.ok) {
          const receipt = await response.json();
          if (
            path.endsWith('/chunks')
              ? receipt.ok !== true
              : receipt.id !== id ||
                (path.endsWith('/complete')
                  ? receipt.state !== 'COMPLETE'
                  : !['UPLOADING', 'COMPLETE'].includes(receipt.state))
          )
            throw Error('Invalid upload receipt.');
          return;
        }
        await response.body?.cancel();
        if (response.status < 500 && response.status !== 429)
          throw Object.assign(Error(`Upload rejected (${response.status}).`), {
            status: response.status,
          });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.startsWith('Upload rejected')
        )
          throw error;
      }
      if (attempt < 2)
        await new Promise((done) =>
          setTimeout(
            done,
            500 * 2 ** attempt + Math.floor(Math.random() * 250),
          ),
        );
    }
    throw Error(
      'Recording upload unavailable; keep the local file and retry later.',
    );
  }
  await post('', {
    id,
    rootCallId,
    externalCallId,
    direction,
    sha256,
    sizeBytes: audio.length,
  });
  for (let offset = 0; offset < audio.length; offset += 32768)
    await post(`/${id}/chunks`, {
      index: offset / 32768,
      data: audio.subarray(offset, offset + 32768).toString('base64'),
    });
  await post(`/${id}/complete`);
  return { id, sizeBytes: audio.length };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [file, rootCallId, externalCallId, direction] = process.argv.slice(2);
  uploadRecording({ file, rootCallId, externalCallId, direction }).then(
    (result) => process.stdout.write(JSON.stringify(result) + '\n'),
    () => {
      process.stderr.write(
        'Recording upload failed; retain the PBX file and inspect configuration.\n',
      );
      process.exitCode = 1;
    },
  );
}
