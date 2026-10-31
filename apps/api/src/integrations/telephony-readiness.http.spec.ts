import 'reflect-metadata';
import { type INestApplication, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { IamService } from '../iam/iam.service';
import { ACCESS_COOKIE } from '../iam/iam.constants';
import { IssabelRecordingsService } from './issabel/recordings.service';
import { TelephonyRecordingReadController } from './issabel/issabel.controller';
import { TelephonyIntegrationService } from './telephony.service';
import { TelephonyRelayController } from './telephony-relay.controller';

describe('telephony readiness HTTP boundary', () => {
  let app: INestApplication;
  const id = '11111111-1111-4111-8111-111111111111';
  const secret = 's'.repeat(40);
  const config = new ConfigService({
    TELEPHONY_RELAY_ENABLED: 'true',
    TELEPHONY_RELAY_SECRET: secret,
    TELEPHONY_RELAY_CONNECTION_ID: id,
  });
  const read = vi.fn().mockResolvedValue({
    audio: Buffer.from([1, 2]),
    start: 1,
    end: 2,
    size: 44,
    partial: true,
  });
  const receive = vi.fn().mockResolvedValue({ id, duplicate: false });
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TelephonyRecordingReadController, TelephonyRelayController],
      providers: [
        { provide: ConfigService, useValue: config },
        { provide: IssabelRecordingsService, useValue: { read } },
        { provide: TelephonyIntegrationService, useValue: { receive } },
        {
          provide: IamService,
          useValue: {
            assertPermissions: IamService.prototype.assertPermissions,
            authenticate: async (token: string) => {
              if (!['allowed', 'read-only'].includes(token))
                throw new UnauthorizedException();
              return {
                userId: id,
                sessionId: id,
                branchIds: [id],
                permissions: [
                  'customer_affairs.call_center.read',
                  ...(token === 'allowed'
                    ? ['customer_affairs.call_center.recordings.read']
                    : []),
                ],
              };
            },
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  }, 30000);
  afterAll(async () => {
    await app?.close();
  });
  it('requires the independent audio permission before returning bytes', async () => {
    const path = `/integrations/telephony/recordings/${id}/audio`;
    await request(app.getHttpServer()).get(path).expect(401);
    await request(app.getHttpServer())
      .get(path)
      .set('Cookie', `${ACCESS_COOKIE}=read-only`)
      .expect(403);
    expect(read).not.toHaveBeenCalled();
    const result = await request(app.getHttpServer())
      .get(path)
      .set('Cookie', `${ACCESS_COOKIE}=allowed`)
      .set('Range', 'bytes=1-2')
      .expect(206);
    expect(result.headers['cache-control']).toBe('private, no-store');
    expect(result.headers['content-range']).toBe('bytes 1-2/44');
    expect(result.headers['content-type']).toContain('audio/wav');
    expect(read).toHaveBeenCalledWith(
      expect.objectContaining({ userId: id }),
      id,
      'bytes=1-2',
    );
  });
  it('rejects unauthenticated/wrong-scope relay input and acknowledges only the durable receipt', async () => {
    const path = '/internal/telephony-relay/events';
    await request(app.getHttpServer())
      .post(path)
      .send({ connectionId: id })
      .expect(401);
    await request(app.getHttpServer())
      .post(path)
      .set('Authorization', 'Bearer wrong')
      .send({ connectionId: id })
      .expect(401);
    await request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${secret}`)
      .send({ connectionId: 'other' })
      .expect(400);
    expect(receive).not.toHaveBeenCalled();
    const result = await request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${secret}`)
      .send({ connectionId: id })
      .expect(201);
    expect(result.body).toEqual({ id, duplicate: false });
    config.set('TELEPHONY_RELAY_ENABLED', 'false');
    await request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${secret}`)
      .send({ connectionId: id })
      .expect(401);
  });
});
