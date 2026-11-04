import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import {
  TelephonyRelayController,
  TelephonyRelayGuard,
} from './telephony-relay.controller';
import { recordingRange } from './issabel/recording-range';
import { TelephonyRecordingReadController } from './issabel/issabel.controller';

describe('telephony readiness boundaries', () => {
  it('requires an explicitly enabled independent relay credential', () => {
    const secret = 'r'.repeat(40);
    const context = (authorization?: string) =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({ headers: { authorization } }),
        }),
      }) as never;
    for (const env of [
      {},
      { TELEPHONY_RELAY_SECRET: secret },
      {
        TELEPHONY_RELAY_ENABLED: 'true',
        TELEPHONY_RELAY_SECRET: secret,
        TELEPHONY_WORKER_SECRET: secret,
      },
    ])
      expect(() =>
        new TelephonyRelayGuard(new ConfigService(env)).canActivate(
          context('Bearer ' + secret),
        ),
      ).toThrow();
    const guard = new TelephonyRelayGuard(
      new ConfigService({
        TELEPHONY_RELAY_ENABLED: 'true',
        TELEPHONY_RELAY_SECRET: secret,
      }),
    );
    for (const value of [undefined, 'Bearer ' + 'ی'.repeat(40), 'Bearer wrong'])
      expect(() => guard.canActivate(context(value))).toThrow();
    expect(guard.canActivate(context('Bearer ' + secret))).toBe(true);
  });
  it('does not let a relay choose another connection or recipient scope', async () => {
    const receive = vi.fn().mockResolvedValue({ id: 'receipt' });
    const controller = new TelephonyRelayController(
      { receive } as never,
      new ConfigService({ TELEPHONY_RELAY_CONNECTION_ID: 'configured' }),
    );
    for (const input of [null, [], {}, { connectionId: 'other' }])
      expect(() => controller.event(input)).toThrow();
    expect(receive).not.toHaveBeenCalled();
    await controller.event({ connectionId: 'configured' });
    expect(receive).toHaveBeenCalledWith(
      { connectionId: 'configured' },
      'RELAY',
    );
  });
  it('handles bounded single audio ranges and rejects invalid/multipart/overflow ranges', () => {
    expect(recordingRange(undefined, 100)).toEqual({
      start: 0,
      end: 99,
      partial: false,
    });
    expect(recordingRange('bytes=20-999', 100)).toEqual({
      start: 20,
      end: 99,
      partial: true,
    });
    expect(recordingRange('bytes=-10', 100)).toEqual({
      start: 90,
      end: 99,
      partial: true,
    });
    expect(recordingRange('bytes=90-', 100)).toEqual({
      start: 90,
      end: 99,
      partial: true,
    });
    for (const range of [
      'bytes=-0',
      'bytes=100-',
      'bytes=90-1',
      'bytes=0-1,3-4',
      'bytes=-',
      'bytes=99999999999999999-',
    ])
      expect(() => recordingRange(range, 100)).toThrow();
  });
  it('serves audio privately and forwards the current actor/range to the authorization service', async () => {
    const read = vi.fn().mockResolvedValue({
      partial: true,
      start: 1,
      end: 2,
      size: 44,
      audio: Buffer.from([1, 2]),
    });
    const controller = new TelephonyRecordingReadController({ read } as never);
    const response = {
      set: vi.fn(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };
    const actor = { userId: 'test' };
    await controller.audio(
      { actor, headers: { range: 'bytes=1-2' } } as never,
      'id',
      response as never,
    );
    expect(read).toHaveBeenCalledWith(actor, 'id', 'bytes=1-2');
    expect(response.status).toHaveBeenCalledWith(206);
    expect(response.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Cache-Control': 'private, no-store',
        'Content-Range': 'bytes 1-2/44',
      }),
    );
  });
});
