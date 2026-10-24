import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { uploadRecording } from './upload-issabel-recording.mjs';

test('PBX uploader preserves bytes, stable replay identity and does not expose credential in payload', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rubi-issabel-test-'));
  const audio = Buffer.alloc(40000, 4);
  audio.write('RIFF');
  audio.writeUInt32LE(audio.length - 8, 4);
  audio.write('WAVE', 8);
  await writeFile(join(directory, 'synthetic.wav'), audio);
  const requests = [];
  const server = createServer(async (request, response) => {
    assert.equal(
      request.headers.authorization,
      'Bearer ' + 'synthetic'.repeat(5),
    );
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    assert.ok(!JSON.stringify(body).includes('synthetic'.repeat(5)));
    requests.push({ path: request.url, body });
    response.writeHead(201, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify(
        request.url.endsWith('/chunks')
          ? { ok: true }
          : request.url.endsWith('/complete')
            ? { id: request.url.split('/')[2], state: 'COMPLETE' }
            : { id: body.id, state: 'UPLOADING' },
      ),
    );
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const env = {
    ISSABEL_RECORDING_DIRECTORY: directory,
    ISSABEL_RECORDING_API_URL: `http://127.0.0.1:${server.address().port}/recordings`,
    ISSABEL_RECORDING_UPLOAD_SECRET: 'synthetic'.repeat(5),
  };
  try {
    const args = {
      file: 'synthetic.wav',
      rootCallId: 'one.1',
      externalCallId: 'one.2',
      direction: 'IN',
    };
    const first = await uploadRecording(args, env);
    const second = await uploadRecording(args, env);
    assert.equal(first.id, second.id);
    const chunks = requests
      .slice(0, 4)
      .filter((r) => r.path.endsWith('/chunks'));
    assert.ok(
      Buffer.concat(
        chunks.map((r) => Buffer.from(r.body.data, 'base64')),
      ).equals(audio),
    );
    await assert.rejects(
      uploadRecording({ ...args, file: '../outside.wav' }, env),
    );
    await assert.rejects(
      uploadRecording(args, {
        ...env,
        ISSABEL_RECORDING_API_URL: 'http://external.example/upload',
      }),
    );
  } finally {
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
    await rm(directory, { recursive: true, force: true });
  }
});
