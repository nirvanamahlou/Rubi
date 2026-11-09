import { zipSync, strToU8 } from 'fflate';
import { XLS_MIME, XLSX_MIME } from '@nora/contracts';
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

function legacyXls(name = 'Workbook') {
  const bytes = Buffer.alloc(1536);
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(bytes);
  bytes.writeUInt16LE(0xfffe, 28);
  bytes.writeUInt16LE(9, 30);
  bytes.writeUInt32LE(1, 44);
  bytes.writeUInt32LE(1, 48);
  bytes.writeUInt32LE(0xfffffffe, 68);
  for (let i = 76; i < 512; i += 4) bytes.writeUInt32LE(0xffffffff, i);
  bytes.writeUInt32LE(0, 76);
  bytes.fill(0xff, 512, 1024);
  bytes.writeUInt32LE(0xfffffffd, 512);
  bytes.writeUInt32LE(0xfffffffe, 516);
  Buffer.from(name + '\0', 'utf16le').copy(bytes, 1024);
  bytes.writeUInt16LE((name.length + 1) * 2, 1088);
  bytes[1090] = 2;
  return bytes;
}
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
    let documents: DocumentsService;
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
        update: {
          allowedMimeTypes: [
            'image/png',
            'image/jpeg',
            'application/pdf',
            XLSX_MIME,
          ],
        },
        create: {
          code: 'WORKBENCH_FEEDBACK_ATTACHMENT',
          name: 'Synthetic attachment',
          domain: 'GENERAL',
          defaultConfidentiality: 'INTERNAL',
          allowedMimeTypes: [
            'image/png',
            'image/jpeg',
            'application/pdf',
            XLSX_MIME,
          ],
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
      documents = new DocumentsService(
        new DocumentsRepository({ client } as never, notifications),
        storage,
        processor as never,
        {} as never,
        {} as never,
      );
      const iam = {
        async validateMessagingRecipients(
          actor: AuthenticatedActor,
          ids: string[],
        ) {
          if (
            !ids.every((id) => actors.has(id)) ||
            !actor.branchIds.includes(branchId)
          )
            throw new Error('Invalid recipients');
          return { branchId, contacts: [] };
        },
        personalProfile(id: string) {
          return client.user.findUniqueOrThrow({
            where: { id },
            include: { profile: true },
          });
        },
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
    it('notifies the mentioned group member once, without notifying an outsider', async () => {
      const text = `Please check @msg-${recipientId}, @msg-${recipientId}. @msg-${outsiderId}`;
      const body = { body: text, clientRequestId: `mention:${randomUUID()}` };
      const send = () =>
        request(app.getHttpServer())
          .post(`/messaging/conversations/${groupId}/messages`)
          .set('x-test-actor', senderId)
          .send(body);
      await send().expect(201);
      await send().expect(201);
      const notices = await client.notification.findMany({
        where: { entityId: groupId, eventType: 'message.mentioned' },
      });
      expect(notices).toHaveLength(1);
      expect(notices[0]).toMatchObject({
        recipientUserId: recipientId,
        actorUserId: senderId,
      });
      expect(notices[0]?.message).toContain('Synthetic group');
      expect(
        await client.notification.count({
          where: {
            entityId: groupId,
            eventType: 'message.received',
            message: text,
          },
        }),
      ).toBe(0);
    });

    it('serves the Workbench photo to conversation members only', async () => {
      await client.documentType.upsert({
        where: { code: 'BRAND_ASSET_TEMPLATE' },
        update: {},
        create: {
          code: 'BRAND_ASSET_TEMPLATE',
          name: 'Synthetic brand',
          domain: 'BRAND',
          defaultConfidentiality: 'INTERNAL',
          allowedMimeTypes: ['image/png'],
          maxFileSizeBytes: BigInt(5 * 1024 * 1024),
          requiresExpiry: false,
        },
      });
      await client.documentCategory.upsert({
        where: { code: 'BRAND_ASSETS' },
        update: {},
        create: { code: 'BRAND_ASSETS', name: 'Synthetic brand' },
      });
      const photo = await documents.uploadOwnProfilePhoto(
        { branchId, title: 'Synthetic avatar' },
        {
          buffer: bytes,
          size: bytes.length,
          mimetype: 'image/png',
          originalname: 'avatar.png',
        },
        actors.get(senderId)!,
        {},
      );
      await client.iamUserProfile.create({
        data: { userId: senderId, photoDocumentId: photo.id },
      });
      const avatar = (viewer: string, target: string) =>
        request(app.getHttpServer())
          .get(`/messaging/conversations/${groupId}/avatars/${target}`)
          .set('x-test-actor', viewer);
      const response = await avatar(recipientId, senderId).expect(200);
      expect(response.headers['content-type']).toMatch(/^image\/png/);
      expect(response.body).toEqual(bytes);
      await avatar(outsiderId, senderId).expect(403);
      await avatar(recipientId, outsiderId).expect(404);
    });
    it.each(
      ['direct', 'group'].flatMap(
        (kind) =>
          [
            [kind, 'test.png', 'image/png', bytes],
            [kind, 'test.xls', XLS_MIME, legacyXls()],
            [
              kind,
              'test.jfif',
              'image/jfif',
              Buffer.from([255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0]),
            ],
            [
              kind,
              'test.pdf',
              'application/pdf',
              Buffer.from('%PDF-1.7 synthetic'),
            ],
            [
              kind,
              'test.xlsx',
              'application/octet-stream',
              Buffer.from(
                zipSync({
                  '[Content_Types].xml': strToU8(
                    '<Types><Override ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml" /></Types>',
                  ),
                  'xl/workbook.xml': strToU8('<workbook/>'),
                }),
              ),
            ],
          ] as const,
      ),
    )(
      'uploads, sends and delivers %s / %s unchanged',
      async (kind, filename, contentType, payload) => {
        const chatId = kind === 'direct' ? conversationId : groupId;
        const http = app.getHttpServer();
        const clientRequestId = `message:${randomUUID()}`;
        const uploaded = await request(http)
          .post(`/messaging/conversations/${chatId}/attachments`)
          .set('x-test-actor', senderId)
          .field('clientRequestId', clientRequestId)
          .attach('file', payload, { filename, contentType })
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
        expect(inbox.body.data).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: sent.body.data.id,
              attachments: expect.arrayContaining([
                expect.objectContaining({ documentId: id }),
              ]),
            }),
          ]),
        );
        const download = await request(http)
          .get(`/messaging/conversations/${chatId}/attachments/${id}`)
          .set('x-test-actor', recipientId)
          .buffer(true)
          .parse((res, callback) => {
            const chunks: Buffer[] = [];
            res.on('data', (chunk: Buffer) => chunks.push(chunk));
            res.on('end', () => callback(null, Buffer.concat(chunks)));
            res.on('error', callback);
          })
          .expect(200);
        expect(download.body).toEqual(payload);
        await request(http)
          .get(`/messaging/conversations/${chatId}/attachments/${id}`)
          .set('x-test-actor', outsiderId)
          .expect(403);
      },
      30000,
    );
    it.each(['direct', 'group'])(
      'persists replies and per-user reactions for %s recipients',
      async (kind) => {
        const http = app.getHttpServer();
        const chatId = kind === 'direct' ? conversationId : groupId;
        const original = await request(http)
          .post(`/messaging/conversations/${chatId}/messages`)
          .set('x-test-actor', senderId)
          .send({
            body: 'Original synthetic message',
            clientRequestId: `message:${randomUUID()}`,
          })
          .expect(201);
        const targetId = original.body.data.id;
        const reply = await request(http)
          .post(`/messaging/conversations/${chatId}/messages`)
          .set('x-test-actor', recipientId)
          .send({
            body: 'Synthetic reply',
            replyToMessageId: targetId,
            clientRequestId: `message:${randomUUID()}`,
          })
          .expect(201);
        expect(reply.body.data.replyTo.id).toBe(targetId);
        expect(reply.body.data.replyTo.sender.id).toBe(senderId);
        const reaction = (actor: string, emoji: string | null) =>
          request(http)
            .put(
              `/messaging/conversations/${chatId}/messages/${targetId}/reaction`,
            )
            .set('x-test-actor', actor)
            .send({ emoji });
        await Promise.all([
          reaction(senderId, '👍').expect(200),
          reaction(senderId, '👍').expect(200),
        ]);
        const liked = await reaction(recipientId, '👍').expect(200);
        expect(liked.body.data.reactions).toEqual([
          {
            emoji: '👍',
            count: 2,
            userIds: expect.arrayContaining([senderId, recipientId]),
            users: expect.arrayContaining([
              expect.objectContaining({
                id: senderId,
                displayName: expect.any(String),
              }),
              expect.objectContaining({
                id: recipientId,
                displayName: expect.any(String),
              }),
            ]),
          },
        ]);
        const changed = await reaction(senderId, '❤️').expect(200);
        expect(
          changed.body.data.reactions.map(
            (r: { emoji: string; count: number }) => [r.emoji, r.count],
          ),
        ).toEqual([
          ['👍', 1],
          ['❤️', 1],
        ]);
        const removed = await reaction(senderId, null).expect(200);
        expect(removed.body.data.reactions).toEqual([
          expect.objectContaining({
            emoji: '👍',
            count: 1,
            userIds: [recipientId],
            users: [
              expect.objectContaining({
                id: recipientId,
                displayName: expect.any(String),
              }),
            ],
          }),
        ]);
        await reaction(senderId, null).expect(200);
        await reaction(outsiderId, '👍').expect(403);
        await reaction(senderId, '😡').expect(400);
        const otherChat = kind === 'direct' ? groupId : conversationId;
        await request(http)
          .put(
            `/messaging/conversations/${otherChat}/messages/${targetId}/reaction`,
          )
          .set('x-test-actor', senderId)
          .send({ emoji: '👍' })
          .expect(404);
        await request(http)
          .post(`/messaging/conversations/${otherChat}/messages`)
          .set('x-test-actor', senderId)
          .send({
            body: 'Cross-chat reply',
            replyToMessageId: targetId,
            clientRequestId: `message:${randomUUID()}`,
          })
          .expect(404);
        await expect(
          client.messagingMessage.create({
            data: {
              conversationId: otherChat,
              senderUserId: senderId,
              body: 'Invalid FK',
              replyToMessageId: targetId,
              clientRequestId: `message:${randomUUID()}`,
            },
          }),
        ).rejects.toThrow();
        const inbox = await request(http)
          .get(`/messaging/conversations/${chatId}/messages`)
          .set('x-test-actor', senderId)
          .expect(200);
        expect(
          inbox.body.data.find(
            (m: { id: string }) => m.id === reply.body.data.id,
          ).replyTo.id,
        ).toBe(targetId);
        expect(
          inbox.body.data.find((m: { id: string }) => m.id === targetId)
            .reactions[0].count,
        ).toBe(1);
      },
      30000,
    );
    it('searches older history with isolated cursor pages and does not mark search as read', async () => {
      const group = await client.messagingConversation.create({
        data: {
          type: 'GROUP',
          branchId,
          creatorUserId: senderId,
          title: 'Search test',
          createRequestId: `group:${randomUUID()}`,
          members: {
            create: [
              { userId: senderId, role: 'OWNER' },
              { userId: recipientId, role: 'MEMBER' },
            ],
          },
        },
      });
      await client.messagingMessage.createMany({
        data: Array.from({ length: 65 }, (_, index) => ({
          conversationId: group.id,
          senderUserId: senderId,
          clientRequestId: `message:${randomUUID()}`,
          body: index < 3 ? 'ArchiveNeedle قرارداد' : 'Recent text',
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)),
        })),
      });
      const http = app.getHttpServer();
      const path = `/messaging/conversations/${group.id}/messages`;
      const first = await request(http)
        .get(path)
        .query({ search: 'archiveneedle', limit: 2 })
        .set('x-test-actor', recipientId)
        .expect(200);
      expect(first.body.data).toHaveLength(2);
      expect(
        first.body.data.every((message: { body: string }) =>
          message.body.includes('ArchiveNeedle'),
        ),
      ).toBe(true);
      expect(first.body.meta.nextCursor).toBeTruthy();
      const second = await request(http)
        .get(path)
        .query({
          search: 'archiveneedle',
          limit: 2,
          cursor: first.body.meta.nextCursor,
        })
        .set('x-test-actor', recipientId)
        .expect(200);
      expect(second.body.data).toHaveLength(1);
      expect(second.body.meta.nextCursor).toBeNull();
      expect(
        new Set(
          [...first.body.data, ...second.body.data].map(
            (message: { id: string }) => message.id,
          ),
        ).size,
      ).toBe(3);
      expect(
        (
          await client.messagingMember.findUniqueOrThrow({
            where: {
              conversationId_userId: {
                conversationId: group.id,
                userId: recipientId,
              },
            },
          })
        ).lastReadAt,
      ).toBeNull();
      await request(http)
        .get(path)
        .query({ search: 'ArchiveNeedle' })
        .set('x-test-actor', outsiderId)
        .expect(403);
      const empty = await request(http)
        .get(`/messaging/conversations/${conversationId}/messages`)
        .query({ search: 'ArchiveNeedle' })
        .set('x-test-actor', recipientId)
        .expect(200);
      expect(empty.body.data).toHaveLength(0);
      const normal = await request(http)
        .get(path)
        .set('x-test-actor', recipientId)
        .expect(200);
      expect(
        normal.body.data.every(
          (message: { body: string }) => message.body === 'Recent text',
        ),
      ).toBe(true);
    });

    it('allows only current group managers to remove or promote members and retains message history', async () => {
      const http = app.getHttpServer();
      const group = await client.messagingConversation.create({
        data: {
          type: 'GROUP',
          branchId,
          creatorUserId: senderId,
          title: 'Member actions test',
          createRequestId: `group:${randomUUID()}`,
          members: {
            create: [
              { userId: senderId, role: 'OWNER' },
              { userId: recipientId, role: 'MEMBER' },
              { userId: outsiderId, role: 'MEMBER' },
            ],
          },
        },
      });
      const path = `/messaging/conversations/${group.id}/members`;
      await request(http)
        .delete(`${path}/${outsiderId}`)
        .set('x-test-actor', recipientId)
        .expect(403);
      await request(http)
        .put(`${path}/${recipientId}/owner`)
        .set('x-test-actor', recipientId)
        .expect(403);
      await request(http)
        .put(
          `/messaging/conversations/${conversationId}/members/${recipientId}/owner`,
        )
        .set('x-test-actor', senderId)
        .expect(403);
      await request(http)
        .delete(`${path}/${senderId}`)
        .set('x-test-actor', senderId)
        .expect(400);
      const sent = await request(http)
        .post(`/messaging/conversations/${group.id}/messages`)
        .set('x-test-actor', outsiderId)
        .send({
          body: 'Preserved history',
          clientRequestId: `message:${randomUUID()}`,
        })
        .expect(201);
      const promoted = await request(http)
        .put(`${path}/${recipientId}/owner`)
        .set('x-test-actor', senderId)
        .expect(200);
      expect(promoted.body.data.participants).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: recipientId, role: 'OWNER' }),
          expect.objectContaining({ id: senderId, role: 'OWNER' }),
        ]),
      );
      await request(http)
        .put(`${path}/${recipientId}/owner`)
        .set('x-test-actor', senderId)
        .expect(200);
      await request(http)
        .delete(`${path}/${outsiderId}`)
        .set('x-test-actor', recipientId)
        .expect(200);
      await request(http)
        .get(`/messaging/conversations/${group.id}/messages`)
        .set('x-test-actor', outsiderId)
        .expect(403);
      await request(http)
        .put(`${path}/${senderId}/owner`)
        .set('x-test-actor', outsiderId)
        .expect(403);
      expect(
        await client.messagingMessage.findUnique({
          where: { id: sent.body.data.id },
        }),
      ).not.toBeNull();
      // Competing owners cannot both remove each other: the shared row lock rechecks authority.
      const outcomes = await Promise.all([
        request(http)
          .delete(`${path}/${recipientId}`)
          .set('x-test-actor', senderId),
        request(http)
          .delete(`${path}/${senderId}`)
          .set('x-test-actor', recipientId),
      ]);
      expect(outcomes.filter((result) => result.status === 200)).toHaveLength(
        1,
      );
      expect(
        outcomes.filter((result) => [403, 404].includes(result.status)),
      ).toHaveLength(1);
      expect(
        await client.messagingMember.count({
          where: { conversationId: group.id, role: 'OWNER' },
        }),
      ).toBe(1);
    });

    it('persists group edits, restricts editors, transfers ownership and revokes access after leaving', async () => {
      const http = app.getHttpServer();
      await request(http)
        .patch(`/messaging/conversations/${groupId}`)
        .set('x-test-actor', recipientId)
        .send({ title: 'Denied title', memberIds: [] })
        .expect(403);
      await request(http)
        .patch(`/messaging/conversations/${groupId}`)
        .set('x-test-actor', senderId)
        .send({ title: 'Renamed group', memberIds: [outsiderId] })
        .expect(200);
      expect(
        await client.messagingMember.count({
          where: { conversationId: groupId },
        }),
      ).toBe(3);
      await request(http)
        .delete(`/messaging/conversations/${groupId}`)
        .set('x-test-actor', senderId)
        .expect(200);
      await request(http)
        .get(`/messaging/conversations/${groupId}/messages`)
        .set('x-test-actor', senderId)
        .expect(403);
      expect(
        await client.messagingMember.count({
          where: { conversationId: groupId, role: 'OWNER' },
        }),
      ).toBe(1);
    });
    it('removes a direct chat only for one user and restores it on a new incoming message', async () => {
      const http = app.getHttpServer();
      await request(http)
        .delete(`/messaging/conversations/${conversationId}`)
        .set('x-test-actor', recipientId)
        .expect(200);
      expect(
        await client.messagingMember.count({
          where: { conversationId, userId: senderId },
        }),
      ).toBe(1);
      const inbox = await request(http)
        .get('/messaging/conversations')
        .set('x-test-actor', recipientId)
        .expect(200);
      expect(
        inbox.body.data.some(
          (row: { id: string }) => row.id === conversationId,
        ),
      ).toBe(false);
      await request(http)
        .post(`/messaging/conversations/${conversationId}/messages`)
        .set('x-test-actor', senderId)
        .send({
          body: 'New message',
          clientRequestId: `message:${randomUUID()}`,
        })
        .expect(201);
      expect(
        await client.messagingMember.count({
          where: { conversationId, userId: recipientId },
        }),
      ).toBe(1);
    });
  },
);
