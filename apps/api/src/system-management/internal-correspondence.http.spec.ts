import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { denyPermission } from '@nora/contracts';
import request from 'supertest';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { IamService } from '../iam/iam.service';
import {
  InternalCorrespondenceController,
  InternalCorrespondenceService,
} from './internal-correspondence';
describe('internal correspondence HTTP access', () => {
  let app: INestApplication;
  const list = vi.fn().mockResolvedValue({ items: [] }),
    send = vi.fn().mockResolvedValue({ id: 'letter' });
  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [InternalCorrespondenceController],
      providers: [
        {
          provide: InternalCorrespondenceService,
          useValue: { list, send, users: vi.fn().mockResolvedValue([]) },
        },
        {
          provide: IamService,
          useValue: {
            authenticate: async (token: string) => ({
              userId: 'server-actor',
              permissions:
                token === 'denied'
                  ? [denyPermission('correspondence.home')]
                  : [],
            }),
            assertPermissions: vi.fn(),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterEach(async () => {
    await app.close();
  });
  it('rejects unauthenticated reads and writes', async () => {
    await request(app.getHttpServer())
      .get('/correspondence/v1/internal')
      .expect(401);
    await request(app.getHttpServer())
      .post('/correspondence/v1/internal')
      .send({})
      .expect(401);
    expect(list).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
  it('enforces explicit screen denial on recipients and inbox', async () => {
    for (const path of [
      '/correspondence/v1/internal',
      '/correspondence/v1/internal/users',
    ])
      await request(app.getHttpServer())
        .get(path)
        .set('Cookie', 'nora_access=denied')
        .expect(403);
    expect(list).not.toHaveBeenCalled();
  });
  it('uses the authenticated actor instead of a client-supplied identity', async () => {
    await request(app.getHttpServer())
      .get('/correspondence/v1/internal?actorUserId=victim')
      .set('Cookie', 'nora_access=allowed')
      .expect(200);
    await request(app.getHttpServer())
      .post('/correspondence/v1/internal')
      .set('Cookie', 'nora_access=allowed')
      .send({ actorUserId: 'victim' })
      .expect(201);
    expect(list.mock.calls[0]![0]).toBe('server-actor');
    expect(send.mock.calls[0]![0]).toBe('server-actor');
  });
});
