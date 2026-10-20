// Run on a trusted PBX-side machine only after StopMixMonitor has closed the file.
import { createHash } from 'node:crypto';
import { open, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function uploadRecording(
  { file, rootCallId, externalCallId, direction },
  env = process.env,
) {
  if (
    !/^[A-Za-z0-9_.-]+\.wav$/.test(file ?? '') ||
    !/^[A-Za-z0-9_.:-]{1,128}$/.test(rootCallId ?? '') ||
    !/^[A-Za-z0-9_.:-]{1,128}$/.test(externalCallId ?? '') ||
    !['IN', 'OUT'].includes(direction)
  )
    throw Error('Invalid recording arguments.');
  const root = await realpath(env.ISSABEL_RECORDING_DIRECTORY ?? '');
  const path = await realpath(resolve(root, file));
  const rel = relative(root, path);
  if (rel.startsWith('..') || isAbsolute(rel))
    throw Error('Recording outside approved directory.');
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
  const handle = await open(path, 'r');
  let audio;
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.size < 44 || before.size > 20971520)
      throw Error('Recording size is unsupported.');
    audio = Buffer.alloc(before.size);
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
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs)
      throw Error('Recording is not finalized.');
  } finally {
    await handle.close();
  }
  if (
    audio.toString('ascii', 0, 4) !== 'RIFF' ||
    audio.toString('ascii', 8, 12) !== 'WAVE'
  )
    throw Error('WAV recording required.');
  const sha256 = createHash('sha256').update(audio).digest('hex');
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
          await response.body?.cancel();
          return;
        }
        if (response.status < 500 && response.status !== 429)
          throw Error(`Upload rejected (${response.status}).`);
        await response.body?.cancel();
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.startsWith('Upload rejected')
        )
          throw error;
      }
      if (attempt < 2)
        await new Promise((done) => setTimeout(done, 500 * 2 ** attempt));
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
