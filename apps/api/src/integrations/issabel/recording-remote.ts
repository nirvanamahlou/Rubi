import { request } from 'node:http';
import { createHash } from 'node:crypto';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

export const MAX_REMOTE_AUDIO_BYTES = 20971520;
export type RemoteRecording = { id: string; sizeBytes: number };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Private same-host Unix socket; no external URL, disk cache or database audio. */
export class IssabelRecordingRemote {
  constructor(private readonly config: ConfigService) {}

  private exchange(path: '/inspect' | '/audio', body: object, limit: number) {
    return new Promise<{ bytes: Buffer; sha: string; contentType: string }>(
      (resolve, reject) => {
        const payload = Buffer.from(JSON.stringify(body));
        let settled = false;
        const fail = (error: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(deadline);
          reject(error);
        };
        const req = request(
          {
            socketPath:
              this.config.get<string>('ISSABEL_RECORDING_SOCKET_PATH') ??
              '/run/rubi-issabel-recordings/bridge.sock',
            path,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': payload.length,
            },
          },
          (response) => {
            if (response.statusCode !== 200) {
              response.resume();
              fail(
                response.statusCode === 404
                  ? new NotFoundException()
                  : new ServiceUnavailableException(
                      'Recording source unavailable.',
                    ),
              );
              return;
            }
            const chunks: Buffer[] = [];
            let size = 0;
            response.on('data', (chunk: Buffer) => {
              size += chunk.length;
              if (size > limit) {
                fail(
                  new ServiceUnavailableException(
                    'Recording source response exceeds limit.',
                  ),
                );
                response.destroy();
                req.destroy();
              } else chunks.push(chunk);
            });
            response.on('error', () =>
              fail(
                new ServiceUnavailableException(
                  'Recording source interrupted.',
                ),
              ),
            );
            response.on('aborted', () =>
              fail(
                new ServiceUnavailableException(
                  'Recording source interrupted.',
                ),
              ),
            );
            response.on('end', () => {
              if (settled) return;
              settled = true;
              clearTimeout(deadline);
              resolve({
                bytes: Buffer.concat(chunks),
                sha: String(response.headers['x-recording-sha256'] ?? ''),
                contentType: String(response.headers['content-type'] ?? ''),
              });
            });
          },
        );
        const deadline = setTimeout(() => {
          fail(new ServiceUnavailableException('Recording source timed out.'));
          req.destroy();
        }, 60000);
        deadline.unref();
        req.on('error', () =>
          fail(
            new ServiceUnavailableException('Recording source unavailable.'),
          ),
        );
        req.end(payload);
      },
    );
  }

  async inspect(rootCallId: string): Promise<RemoteRecording[]> {
    const response = await this.exchange('/inspect', { rootCallId }, 65536);
    let rows: unknown;
    try {
      rows = JSON.parse(response.bytes.toString('utf8'));
    } catch {
      throw new ServiceUnavailableException(
        'Invalid recording source response.',
      );
    }
    if (
      !Array.isArray(rows) ||
      rows.length > 128 ||
      rows.some(
        (row) =>
          !row ||
          typeof row.id !== 'string' ||
          !uuid.test(row.id) ||
          !Number.isInteger(row.sizeBytes) ||
          row.sizeBytes < 44 ||
          row.sizeBytes > MAX_REMOTE_AUDIO_BYTES,
      ) ||
      new Set(rows.map((row) => row.id)).size !== rows.length
    )
      throw new ServiceUnavailableException(
        'Invalid recording source response.',
      );
    return rows.map((row) => ({ id: row.id, sizeBytes: row.sizeBytes }));
  }

  async audio(rootCallId: string, id: string) {
    if (!uuid.test(id)) throw new NotFoundException();
    const { bytes, sha, contentType } = await this.exchange(
      '/audio',
      { rootCallId, id },
      MAX_REMOTE_AUDIO_BYTES,
    );
    if (
      contentType !== 'audio/wav' ||
      bytes.length < 44 ||
      bytes.subarray(0, 4).toString() !== 'RIFF' ||
      bytes.subarray(8, 12).toString() !== 'WAVE' ||
      bytes.readUInt32LE(4) + 8 !== bytes.length ||
      !/^[a-f0-9]{64}$/.test(sha) ||
      createHash('sha256').update(bytes).digest('hex') !== sha
    )
      throw new ServiceUnavailableException('Invalid recording audio.');
    return bytes;
  }
}
