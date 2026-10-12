import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import { denyPermission } from '@nora/contracts';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IamService } from '../iam/iam.service';
import {
  CorrespondenceNumberingController,
  CorrespondenceNumberingService,
} from './correspondence-numbering';

describe('letter numbering authorization over HTTP', () => {
  let app: INestApplication;
  const issue = vi
    .fn()
    .mockResolvedValue({ number: 'NS/1405/07/20/000001', date: '1405/07/20' });
  beforeEach(async () => {
    issue.mockClear();
    const module = await Test.createTestingModule({
      controllers: [CorrespondenceNumberingController],
      providers: [
        { provide: CorrespondenceNumberingService, useValue: { issue } },
        {
          provide: IamService,
          useValue: {
            authenticate: async (token: string) => ({
              userId: 'actor',
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
  it('rejects an unauthenticated request without allocating any number', async () => {
    await request(app.getHttpServer())
      .post('/correspondence/v1/numbers')
      .send({})
      .expect(401);
    expect(issue).not.toHaveBeenCalled();
  });
  it('rejects explicit screen denial before issuing', async () => {
    await request(app.getHttpServer())
      .post('/correspondence/v1/numbers')
      .set('Cookie', 'nora_access=denied')
      .send({})
      .expect(403);
    expect(issue).not.toHaveBeenCalled();
  });
  it('uses the authenticated actor instead of a supplied actor ID', async () => {
    await request(app.getHttpServer())
      .post('/correspondence/v1/numbers')
      .set('Cookie', 'nora_access=allowed')
      .send({ actorUserId: 'other' })
      .expect(201);
    expect(issue.mock.calls[0]![1]).toBe('actor');
  });
});
