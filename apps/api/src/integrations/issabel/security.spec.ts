import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { validateSync } from 'class-validator';
import {
  IssabelRecordingGuard,
  OriginateDto,
  RecordingChunkDto,
} from './issabel.controller';
import { IssabelService } from './issabel.service';
import { IssabelRecordingsService } from './recordings.service';

describe('Issabel authorization boundary', () => {
  const context = (authorization?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization } }),
      }),
    }) as never;
  it('requires an enabled, separate recording credential and rejects Unicode/worker-token confusion', () => {
    const key = 'r'.repeat(40);
    const guard = new IssabelRecordingGuard(
      new ConfigService({
        ISSABEL_ENABLED: 'true',
        ISSABEL_RECORDING_UPLOAD_SECRET: key,
        TELEPHONY_WORKER_SECRET: 'w'.repeat(40),
      }),
    );
    for (const value of [
      undefined,
      'Bearer wrong',
      'Bearer ' + 'ی'.repeat(40),
      'Bearer ' + 'w'.repeat(40),
    ])
      expect(() => guard.canActivate(context(value))).toThrow();
    expect(guard.canActivate(context('Bearer ' + key))).toBe(true);
    expect(() =>
      new IssabelRecordingGuard(
        new ConfigService({ ISSABEL_RECORDING_UPLOAD_SECRET: key }),
      ).canActivate(context('Bearer ' + key)),
    ).toThrow();
    expect(() =>
      new IssabelRecordingGuard(
        new ConfigService({
          ISSABEL_ENABLED: 'true',
          ISSABEL_RECORDING_UPLOAD_SECRET: key,
          TELEPHONY_WORKER_SECRET: key,
        }),
      ).canActivate(context('Bearer ' + key)),
    ).toThrow();
  });
  it('rejects client channel/context/actor overrides and oversized audio at the DTO boundary', () => {
    const dto = Object.assign(new OriginateDto(), {
      id: '11111111-1111-4111-8111-111111111111',
      connectionId: '11111111-1111-4111-8111-111111111111',
      number: '09120000001',
      channel: 'SIP/admin',
    });
    expect(
      validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).not.toHaveLength(0);
    expect(
      validateSync(
        Object.assign(new RecordingChunkDto(), {
          index: 640,
          data: 'x'.repeat(44000),
        }),
      ),
    ).toHaveLength(2);
  });
  it('disabled adapter opens no socket or polling timer', async () => {
    const db = {
      client: { integrationTelephonyConnection: { findUnique: vi.fn() } },
    };
    const service = new IssabelService(
      db as never,
      new ConfigService({}),
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    service.onModuleInit();
    expect(
      db.client.integrationTelephonyConnection.findUnique,
    ).not.toHaveBeenCalled();
    service.onModuleDestroy();
    const media = new IssabelRecordingsService(
      db as never,
      new ConfigService({}),
      {} as never,
      {} as never,
    );
    await expect(media.start({} as never)).rejects.toThrow();
    expect(
      db.client.integrationTelephonyConnection.findUnique,
    ).not.toHaveBeenCalled();
  });
});
