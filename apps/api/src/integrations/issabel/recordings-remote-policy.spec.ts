import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { IssabelRecordingRemote } from './recording-remote';
import { IssabelRecordingsService } from './recordings.service';

function fixture() {
  const tx = {
    $queryRaw: vi.fn(),
    integrationTelephonyConnection: {
      findUnique: vi.fn().mockResolvedValue({ active: true, synthetic: false }),
    },
    integrationTelephonyAudit: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
    },
  };
  // No recording/chunk model is provided: any database audio access fails the test.
  const db = {
    client: {
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    },
  };
  const domain = {
    authorizeRecordingDownload: vi.fn(),
    callRecordingContext: vi
      .fn()
      .mockResolvedValue({
        connectionId: 'connection',
        rootCallId: 'synthetic.1',
      }),
  };
  const service = new IssabelRecordingsService(
    db as never,
    new ConfigService({
      ISSABEL_ENABLED: 'true',
      ISSABEL_CONNECTION_ID: 'connection',
    }),
    domain as never,
    {} as never,
  );
  const actor = { userId: 'actor' } as never;
  return { service, actor, tx, db, domain };
}
describe('remote recordings have no persistent audio storage', () => {
  it('rejects all upload phases by default, without database access or maintenance', async () => {
    const f = fixture();
    f.service.onModuleInit();
    await f.service.maintain();
    await expect(f.service.start({} as never)).rejects.toThrow(
      'storage is disabled',
    );
    await expect(f.service.chunk('id', 0, '')).rejects.toThrow(
      'storage is disabled',
    );
    await expect(f.service.finish('id')).rejects.toThrow('storage is disabled');
    expect(f.db.client.$transaction).not.toHaveBeenCalled();
    f.service.onModuleDestroy();
  });
  it('fetches each authorized request afresh and writes only an audit receipt', async () => {
    const f = fixture();
    const inspect = vi
      .spyOn(IssabelRecordingRemote.prototype, 'inspect')
      .mockResolvedValue([]);
    const audio = vi
      .spyOn(IssabelRecordingRemote.prototype, 'audio')
      .mockResolvedValue(Buffer.from('test audio'));
    try {
      await f.service.forCall(f.actor, 'call');
      await f.service.read(f.actor, 'id', undefined, 'call');
      await f.service.read(f.actor, 'id', undefined, 'call');
      expect(inspect).toHaveBeenCalledWith('synthetic.1');
      expect(audio).toHaveBeenCalledTimes(2);
      expect(f.tx.integrationTelephonyAudit.create).toHaveBeenCalledTimes(3);
    } finally {
      inspect.mockRestore();
      audio.mockRestore();
    }
  });
  it('denies unauthorized actors before any PBX or database operation', async () => {
    const f = fixture();
    f.domain.authorizeRecordingDownload.mockRejectedValue(
      new Error('Forbidden'),
    );
    await expect(f.service.forCall(f.actor, 'call')).rejects.toThrow(
      'Forbidden',
    );
    await expect(
      f.service.read(f.actor, 'id', undefined, 'call'),
    ).rejects.toThrow('Forbidden');
    expect(f.domain.callRecordingContext).not.toHaveBeenCalled();
    expect(f.db.client.$transaction).not.toHaveBeenCalled();
  });
  it('requires a proven ended root and active matching connection', async () => {
    const f = fixture();
    f.domain.callRecordingContext.mockResolvedValue({
      connectionId: 'other',
      rootCallId: 'synthetic.1',
    });
    await expect(f.service.forCall(f.actor, 'call')).rejects.toThrow();
    await expect(f.service.read(f.actor, 'id')).rejects.toThrow();
    expect(f.db.client.$transaction).not.toHaveBeenCalled();
  });
  it('rate limits before contacting the PBX', async () => {
    const f = fixture();
    f.tx.integrationTelephonyAudit.count.mockResolvedValue(60);
    await expect(f.service.forCall(f.actor, 'call')).rejects.toThrow(
      'rate exceeded',
    );
    expect(f.tx.integrationTelephonyAudit.create).not.toHaveBeenCalled();
  });
});
