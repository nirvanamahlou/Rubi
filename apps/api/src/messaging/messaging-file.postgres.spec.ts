import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  UnauthorizedException,
  type INestApplication,
  type ExecutionContext,
} from '@nestjs/common';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { MessagingRepository } from './messaging.repository';
import { DocumentsService } from '../documents/documents.service';
import { DocumentsRepository } from '../documents/documents.repository';
import { LocalDocumentStorage } from '../documents/documents.storage';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsRepository } from '../notifications/notifications.repository';
import { AuthGuard } from '../iam/auth.guard';

const enabled = process.env.NORA_RUN_MESSAGING_FILE_POSTGRES_TESTS === '1';
describe.skipIf(!enabled)(
  'real PostgreSQL and multipart chat attachment delivery',
  () => {
    let client: DatabaseClient, app: INestApplication, root: string;
    const branchId = randomUUID(),
      senderId = randomUUID(),
      recipientId = randomUUID(),
      outsiderId = randomUUID();
    let conversationId: string, groupId: string;
    const bytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0o0AAAAASUVORK5CYII=',
      'base64',
    );
    const actors = new Map<string, AuthenticatedActor>();
    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? '');
      if (
        !['127.0.0.1', 'localhost'].includes(url.hostname) ||
        !['/nora_workbench_test_1018', '/nora_ci'].includes(url.pathname)
      )
        throw new Error('A named local disposable test database is required.');
      client = createDatabaseClient(url.toString());
      await client.branch.create({
        data: {
          id: branchId,
          code: `msg-${branchId}`,
          name: 'Synthetic messaging branch',
        },
      });
      for (const id of [senderId, recipientId, outsiderId]) {
        await client.user.create({
          data: {
            id,
            username: `msg-${id}`,
            displayName: 'Synthetic test user',
            passwordHash: 'not-a-login-hash',
            status: 'ACTIVE',
            branches: { create: { branchId } },
          },
        });
        actors.set(id, {
          userId: id,
          branchIds: [branchId],
          permissions: [],
        } as unknown as AuthenticatedActor);
      }
      await client.documentType.upsert({
        where: { code: 'WORKBENCH_FEEDBACK_ATTACHMENT' },
        update: {},
        create: {
          code: 'WORKBENCH_FEEDBACK_ATTACHMENT',
          name: 'Synthetic attachment',
          domain: 'GENERAL',
          defaultConfidentiality: 'INTERNAL',
          allowedMimeTypes: ['image/png', 'image/jpeg', 'application/pdf'],
          maxFileSizeBytes: BigInt(10 * 1024 * 1024),
          requiresExpiry: false,
        },
      });
      await client.documentCategory.upsert({
        where: { code: 'GENERAL_ARCHIVE' },
        update: {},
        create: { code: 'GENERAL_ARCHIVE', name: 'Synthetic archive' },
      });
      const notifications = new NotificationsService(
        new NotificationsRepository({ client } as never),
      );
      const repository = new MessagingRepository(
        { client } as never,
        notifications,
      );
      const conversation = await repository.createDirect({
        actorUserId: senderId,
        recipientId,
        branchId,
        directPairKey: `${senderId}:${recipientId}`,
        clientRequestId: `direct:${randomUUID()}`,
      });
      conversationId = conversation.id;
      const group = await repository.createGroup({
        actorUserId: senderId,
        memberIds: [recipientId],
        branchId,
        title: 'Synthetic group',
        clientRequestId: `group:${randomUUID()}`,
      });
      groupId = group.id;
      root = await mkdtemp(join(tmpdir(), 'rubi-message-files-'));
      const storage = new LocalDocumentStorage(
        new ConfigService({
          DOCUMENTS_STORAGE_ROOT: root,
          DOCUMENTS_STORAGE_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 9).toString(
            'base64',
          ),
        }),
      );
      // No antivirus verdict: exercise the owner-approved immediate chat delivery policy.
      const processor = {
        async processVersion() {
          return false;
        },
      };
      const documents = new DocumentsService(
        new DocumentsRepository({ client } as never, notifications),
        storage,
        processor as never,
        {} as never,
        {} as never,
      );
      const iam = {
        describeMessagingParticipants(ids: string[]) {
          return client.user.findMany({
            where: { id: { in: ids } },
            select: { id: true, displayName: true, username: true },
          });
        },
      };
      const service = new MessagingService(repository, iam as never, documents);
      const module = await Test.createTestingModule({
        controllers: [MessagingController],
        providers: [{ provide: MessagingService, useValue: service }],
      })
        .overrideGuard(AuthGuard)
        .useValue({
          canActivate(context: ExecutionContext) {
            const req = context.switchToHttp().getRequest();
            const actor = actors.get(req.headers['x-test-actor']);
            if (!actor) throw new UnauthorizedException();
            req.actor = actor;
            return true;
          },
        })
        .compile();
      app = module.createNestApplication();
      await app.init();
    }, 30000);
    afterAll(async () => {
      await app?.close();
      await client?.$disconnect();
      if (root) await rm(root, { recursive: true, force: true });
    });
    it.each(['direct', 'group'])(
      'uploads, sends and delivers the same file in a %s chat',
      async (kind) => {
        const chatId = kind === 'direct' ? conversationId : groupId;
        const http = app.getHttpServer();
        const clientRequestId = `message:${randomUUID()}`;
        const uploaded = await request(http)
          .post(`/messaging/conversations/${chatId}/attachments`)
          .set('x-test-actor', senderId)
          .field('clientRequestId', clientRequestId)
          .attach('file', bytes, {
            filename: 'test.png',
            contentType: 'image/png',
          })
          .expect(201);
        const id = uploaded.body.data.id;
        expect(uploaded.body.data.scanStatus).toBe(
          'AWAITING_ANTIVIRUS_ADAPTER',
        );
        expect(id).toBeTruthy();
        const sent = await request(http)
          .post(`/messaging/conversations/${chatId}/messages`)
          .set('x-test-actor', senderId)
          .send({ body: '', clientRequestId, attachmentDocumentIds: [id] })
          .expect(201);
        expect(sent.body.data.attachments[0].documentId).toBe(id);
        expect(sent.body.data.body).toBe('فایل پیوست');
        const retried = await request(http)
          .post(`/messaging/conversations/${chatId}/messages`)
          .set('x-test-actor', senderId)
          .send({ body: '', clientRequestId, attachmentDocumentIds: [id] })
          .expect(201);
        expect(retried.body.data.id).toBe(sent.body.data.id);
        await request(http)
          .post(`/messaging/conversations/${chatId}/messages`)
          .set('x-test-actor', recipientId)
          .send({ body: '', clientRequestId, attachmentDocumentIds: [id] })
          .expect(400);
        await request(http)
          .post(`/messaging/conversations/${chatId}/messages`)
          .set('x-test-actor', senderId)
          .send({ body: ' ', clientRequestId: `message:${randomUUID()}` })
          .expect(400);
        const inbox = await request(http)
          .get(`/messaging/conversations/${chatId}/messages`)
          .set('x-test-actor', recipientId)
          .expect(200);
        expect(inbox.body.data[0].attachments[0].documentId).toBe(id);
        const download = await request(http)
          .get(`/messaging/conversations/${chatId}/attachments/${id}`)
          .set('x-test-actor', recipientId)
          .expect(200);
        expect(download.body).toEqual(bytes);
        await request(http)
          .get(`/messaging/conversations/${chatId}/attachments/${id}`)
          .set('x-test-actor', outsiderId)
          .expect(403);
      },
      30000,
    );
  },
);
