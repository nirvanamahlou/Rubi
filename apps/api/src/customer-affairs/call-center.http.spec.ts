import { CallCenterReadController } from './call-center-read.controller';
import { CallCenterReadService } from './call-center-read.service';
import 'reflect-metadata';
import {
  ForbiddenException,
  UnauthorizedException,
  ValidationPipe,
  type INestApplication,
  type ExecutionContext,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { AuthGuard } from '../iam/auth.guard';
import { PermissionGuard } from '../iam/permission.guard';
import { IamService } from '../iam/iam.service';
import { CallCenterController } from './call-center.controller';
import { CallCenterService } from './call-center.service';

describe('Call Center authenticated HTTP boundary', () => {
  let app: INestApplication;
  const service = {
    search: vi.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
    list: vi.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
    create: vi.fn().mockResolvedValue({ data: { id: 'saved' } }),
    note: vi.fn().mockResolvedValue({ data: { id: 'note' } }),
  };
  const input = {
    id: 'b17c447c-a715-4a2a-bbf8-82409c60000a',
    phone: '09120000001',
    occurredAt: '2026-10-18T12:00:00Z',
    direction: 'INBOUND',
    name: 'Synthetic',
    subject: 'Test call',
    source: 'گوگل',
    operator: 'واحد ویزا',
    status: 'جدید',
    outcome: 'ANSWERED',
    note: '',
  };
  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [CallCenterController, CallCenterReadController],
      providers: [
        PermissionGuard,
        { provide: CallCenterReadService, useValue: service },
        { provide: CallCenterService, useValue: service },
        {
          provide: IamService,
          useValue: {
            assertPermissions(
              actor: { permissions: string[] },
              required: string[],
            ) {
              if (!required.every((p) => actor.permissions.includes(p)))
                throw new ForbiddenException();
            },
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest();
          if (!req.headers['x-test-actor']) throw new UnauthorizedException();
          req.actor = {
            userId: 'synthetic',
            branchIds: ['synthetic'],
            permissions:
              req.headers['x-test-actor'] === 'writer'
                ? [
                    'customer_affairs.call_center.read',
                    'customer_affairs.call_center.calls.create',
                    'customer_affairs.call_center.notes.create',
                  ]
                : ['customer_affairs.call_center.read'],
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });
  afterEach(async () => {
    await app?.close();
  });
  it('denies unauthenticated reads and read-only mutations', async () => {
    await request(app.getHttpServer())
      .get('/customer-affairs/call-center')
      .expect(401);
    await request(app.getHttpServer())
      .post('/customer-affairs/call-center/calls')
      .set('x-test-actor', 'reader')
      .send(input)
      .expect(403);
    expect(service.list).not.toHaveBeenCalled();
    expect(service.create).not.toHaveBeenCalled();
  });
  it('rejects malformed dates, status and untrusted provider fields before persistence', async () => {
    for (const patch of [
      { occurredAt: 'invalid' },
      { id: 'bad-id' },
      { status: 'INVALID' },
      { recordings: [{ url: 'https://untrusted.example/a' }] },
      { outcome: 'UNKNOWN' },
      { outcome: undefined },
      { outcome: null },
      { outcome: '' },
      { note: 'x'.repeat(2001) },
    ]) {
      await request(app.getHttpServer())
        .post('/customer-affairs/call-center/calls')
        .set('x-test-actor', 'writer')
        .send({ ...input, ...patch })
        .expect(400);
    }
    expect(service.create).not.toHaveBeenCalled();
  });
  it('forwards validated fields and branch scope; bounds pagination', async () => {
    await request(app.getHttpServer())
      .post('/customer-affairs/call-center/calls')
      .set('x-test-actor', 'writer')
      .set('x-branch-id', 'branch')
      .send(input)
      .expect(201);
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining(input),
      expect.objectContaining({ userId: 'synthetic' }),
      'branch',
    );
    await request(app.getHttpServer())
      .get('/customer-affairs/call-center?pageSize=51')
      .set('x-test-actor', 'writer')
      .expect(400);
  });
  it('rejects foreign input keys and invalid note targets', async () => {
    await request(app.getHttpServer())
      .post('/customer-affairs/call-center/contacts/not-a-uuid/notes')
      .set('x-test-actor', 'writer')
      .send({ id: input.id, text: 'note' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/customer-affairs/call-center/contacts/' + input.id + '/notes')
      .set('x-test-actor', 'writer')
      .send({ id: input.id, text: 'note', actorUserId: 'forged' })
      .expect(400);
    expect(service.note).not.toHaveBeenCalled();
  });
  it('validates search limits and keeps search responses private', async () => {
    await request(app.getHttpServer())
      .post('/customer-affairs/call-center/search')
      .send({})
      .expect(401);
    for (const patch of [
      { pageSize: 51 },
      { page: 0 },
      { query: 'x'.repeat(121) },
      { direction: 'INVALID' },
      { teamId: 'bad-id' },
      { unexpected: 'private' },
    ])
      await request(app.getHttpServer())
        .post('/customer-affairs/call-center/search')
        .set('x-test-actor', 'reader')
        .send(patch)
        .expect(400);
    expect(service.search).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .post('/customer-affairs/call-center/search')
      .set('x-test-actor', 'reader')
      .set('x-branch-id', 'branch')
      .send({ query: 'کیش', page: 1 })
      .expect('Cache-Control', 'private, no-store')
      .expect(201);
    expect(service.search).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'synthetic' }),
      'branch',
      expect.objectContaining({ query: 'کیش', page: 1, pageSize: 20 }),
    );
  });
});
