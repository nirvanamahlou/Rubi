import { createServer, type Server } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { IssabelRecordingRemote } from './recording-remote';

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((s) => new Promise<void>((r) => s.close(() => r()))),
  );
});
async function source(
  body: Buffer | string,
  contentType = 'application/json',
  sha = '',
  status = 200,
) {
  const socket =
    process.platform === 'win32'
      ? `\\\\.\\pipe\\recordings-${randomUUID()}`
      : join(tmpdir(), `rec-${randomUUID()}.sock`);
  const server = createServer((req, res) => {
    req.resume();
    res.writeHead(status, {
      'Content-Type': contentType,
      'X-Recording-Sha256': sha,
    });
    res.end(body);
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(socket, resolve));
  return new IssabelRecordingRemote(
    new ConfigService({ ISSABEL_RECORDING_SOCKET_PATH: socket }),
  );
}
describe('on-demand recording source', () => {
  it('returns only opaque identifiers and size, without PBX paths', async () => {
    const id = randomUUID();
    const client = await source(
      JSON.stringify([{ id, sizeBytes: 44, file: 'private.wav' }]),
    );
    expect(await client.inspect('synthetic.1')).toEqual([
      { id, sizeBytes: 44 },
    ]);
  });
  it('rejects duplicate and malformed identifiers', async () => {
    const id = randomUUID();
    const client = await source(
      JSON.stringify([
        { id, sizeBytes: 44 },
        { id, sizeBytes: 44 },
      ]),
    );
    await expect(client.inspect('synthetic.1')).rejects.toThrow();
  });
  it('verifies complete WAV and digest on every download', async () => {
    const wav = Buffer.alloc(44);
    wav.write('RIFF');
    wav.writeUInt32LE(36, 4);
    wav.write('WAVE', 8);
    const client = await source(
      wav,
      'audio/wav',
      createHash('sha256').update(wav).digest('hex'),
    );
    expect(await client.audio('synthetic.1', randomUUID())).toEqual(wav);
  });
  it('fails closed for corruption, unavailable source and missing recording', async () => {
    const bad = await source(Buffer.alloc(44), 'audio/wav', '0'.repeat(64));
    await expect(bad.audio('synthetic.1', randomUUID())).rejects.toThrow();
    const missing = await source('', 'text/plain', '', 404);
    await expect(missing.inspect('synthetic.1')).rejects.toThrow();
    const unavailable = await source('', 'text/plain', '', 503);
    await expect(unavailable.inspect('synthetic.1')).rejects.toThrow();
  });
});
