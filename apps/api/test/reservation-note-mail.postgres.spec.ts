import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import { ReservationMailService } from '../src/reservations/reservation-mail.service';
import { sealMail } from '../src/reservations/reservation-note-mail';
import { NotificationsService } from '../src/notifications/notifications.service';
import { NotificationsRepository } from '../src/notifications/notifications.repository';
import type * as SmtpModule from '../src/integrations/reservation-mail/smtp';
import { ConfigService } from '@nestjs/config';
import { MasterDataContactCrypto } from '../src/master-data/master-data-contact.crypto';
const smtp = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock(
  '../src/integrations/reservation-mail/smtp',
  async (importOriginal) => ({
    ...(await importOriginal<typeof SmtpModule>()),
    sendNoteMail: smtp.send,
  }),
);

// Deliberately separate from DATABASE_URL; never run against a configured ERP DB.
const url = process.env.RESERVATION_MAIL_TEST_DATABASE_URL;
describe.skipIf(!url)('reservation note outbox on dedicated PostgreSQL', () => {
  let db: DatabaseClient;
  let service: ReservationMailService;
  let second: ReservationMailService;
  let intakeId: string;
  let contactId: string;
  let organizationId: string;
  let revisionId: string;
  const userId = randomUUID();
  const key = Buffer.alloc(32, 9);
  let version = 0;
  beforeAll(async () => {
    const target = new URL(url!);
    if (
      target.hostname !== '127.0.0.1' ||
      target.port !== '55488' ||
      target.pathname !== '/mail_test' ||
      target.username !== 'mail_test'
    )
      throw new Error('Dedicated disposable mail_test database required.');
    db = createDatabaseClient(url);
    await db.user.create({
      data: {
        id: userId,
        username: `mail-test-${userId}`,
        displayName: 'Synthetic mail test',
        passwordHash: 'not-a-login',
      },
    });
    const organization = await db.masterOrganization.create({
      data: {
        code: `MAIL_${userId.slice(0, 8)}`,
        legalName: 'Synthetic',
        displayName: 'Synthetic',
        createdByUserId: userId,
        updatedByUserId: userId,
      },
    });
    organizationId = organization.id;
    const protectedEmail = new MasterDataContactCrypto(
      new ConfigService({
        MASTER_DATA_IMPORT_TOKEN_KEY_BASE64: key.toString('base64'),
      }),
    ).protect('email', 'broker@example.test');
    const contact = await db.masterOrganizationContact.create({
      data: {
        organizationId,
        code: `MAIL_${userId.slice(0, 8)}`,
        fullName: 'Synthetic mail',
        jobTitle: 'PARTNER_EMAIL',
        emailEncrypted: protectedEmail.encrypted,
        emailEncryptionIv: protectedEmail.encryptionIv,
        emailEncryptionAuthTag: protectedEmail.encryptionAuthTag,
        emailEncryptionKeyVersion: protectedEmail.encryptionKeyVersion,
        emailMasked: protectedEmail.masked,
        emailFingerprint: protectedEmail.fingerprint,
        createdByUserId: userId,
        updatedByUserId: userId,
      },
    });
    contactId = contact.id;
    const intake = await db.reservationIntake.create({
      data: {
        requestId: randomUUID(),
        contractId: randomUUID(),
        contractVersion: 1,
        branchId: randomUUID(),
        fingerprint: 'synthetic',
        snapshot: { contractNumber: 'SYNTHETIC-MAIL' },
      },
    });
    intakeId = intake.id;
    const database = { client: db };
    const notifications = new NotificationsService(
      new NotificationsRepository(database as never),
    );
    service = new ReservationMailService(
      database as never,
      {} as never,
      {} as never,
      notifications,
    );
    second = new ReservationMailService(
      database as never,
      {} as never,
      {} as never,
      notifications,
    );
  }, 30000);
  beforeEach(async () => {
    vi.clearAllMocks();
    for (const [name, value] of Object.entries({
      RESERVATION_MAIL_ENABLED: 'true',
      RESERVATION_MAIL_KEY_BASE64: key.toString('base64'),
      RESERVATION_MAIL_LEGAL_ENTITY_ID: 'company',
      RESERVATION_SMTP_HOST: 'smtp.example.test',
      RESERVATION_SMTP_PORT: '587',
      RESERVATION_SMTP_TLS: 'starttls',
      RESERVATION_SMTP_USER: 'synthetic',
      RESERVATION_SMTP_PASSWORD: 'synthetic',
      RESERVATION_MAIL_FROM: 'reservation@example.test',
      RESERVATION_MAIL_FROM_NAME: 'Synthetic',
      RESERVATION_MAIL_REPLY_TO: 'reservation@example.test',
    }))
      vi.stubEnv(name, value);
    await db.reservationNoteMail.deleteMany({
      where: { revision: { intakeId } },
    });
    await db.notification.deleteMany({ where: { recipientUserId: userId } });
    const revision = await db.reservationWorkflowRevision.create({
      data: {
        intakeId,
        version: ++version,
        actorUserId: userId,
        state: { supplierStatus: 'REQUESTED' },
      },
    });
    revisionId = revision.id;
    smtp.send.mockResolvedValue({ messageId: 'synthetic' });
  });
  afterEach(() => vi.unstubAllEnvs());
  afterAll(async () => {
    if (!db) return;
    if (intakeId) {
      await db.reservationNoteMail.deleteMany({
        where: { revision: { intakeId } },
      });
      await db.reservationWorkflowRevision.deleteMany({ where: { intakeId } });
      await db.reservationIntake.delete({ where: { id: intakeId } });
    }
    if (contactId)
      await db.masterOrganizationContact.delete({ where: { id: contactId } });
    if (organizationId)
      await db.masterOrganization.delete({ where: { id: organizationId } });
    await db.notification.deleteMany({ where: { recipientUserId: userId } });
    await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  });
  function prepared() {
    const id = randomUUID();
    return {
      id,
      contactId,
      envelope: sealMail(
        {
          id,
          to: 'broker@example.test',
          subject: 'SYNTHETIC',
          pdfBase64: Buffer.from('%PDF-1.4 synthetic').toString('base64'),
          filename: 'reservation-form-TEST.pdf',
          from: 'reservation@example.test',
          fromName: 'Synthetic',
          replyTo: 'reservation@example.test',
          legalEntityId: 'company',
        },
        key,
        id,
      ),
    };
  }
  async function queue() {
    const mail = prepared();
    await db.$transaction((tx) => service.enqueue(tx, mail, revisionId));
    return mail;
  }
  it('rolls back the revision and email together on transaction failure', async () => {
    const id = randomUUID();
    await expect(
      db.$transaction(async (tx) => {
        await tx.reservationWorkflowRevision.create({
          data: {
            id,
            intakeId,
            version: ++version,
            actorUserId: userId,
            state: {},
          },
        });
        await service.enqueue(tx, prepared(), id);
        throw new Error('ROLLBACK');
      }),
    ).rejects.toThrow('ROLLBACK');
    expect(
      await db.reservationWorkflowRevision.findUnique({ where: { id } }),
    ).toBeNull();
    expect(
      await db.reservationNoteMail.count({ where: { revision: { intakeId } } }),
    ).toBe(0);
  });
  it('enforces revision/contact foreign keys and one email per command revision', async () => {
    await queue();
    await expect(
      db.$transaction((tx) => service.enqueue(tx, prepared(), revisionId)),
    ).rejects.toThrow();
    await expect(
      db.$transaction((tx) => service.enqueue(tx, prepared(), randomUUID())),
    ).rejects.toThrow();
  });
  it('claims once across API replicas and commits acceptance with one recipient notification', async () => {
    const mail = await queue();
    await Promise.all([service.sweep(), second.sweep()]);
    expect(smtp.send).toHaveBeenCalledTimes(1);
    expect(smtp.send.mock.calls[0]![1].pdfBase64).toBe(
      Buffer.from('%PDF-1.4 synthetic').toString('base64'),
    );
    expect(smtp.send.mock.calls[0]![1].text).toBeUndefined();
    expect(
      await db.reservationNoteMail.findUnique({ where: { id: mail.id } }),
    ).toMatchObject({ status: 'ACCEPTED', attempts: 1 });
    const notifications = await db.notification.findMany({
      where: { recipientUserId: userId },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]!.message).toContain('SYNTHETIC-MAIL');
  });
  it('bounds explicit temporary SMTP rejection retries to five attempts', async () => {
    const mail = await queue();
    smtp.send.mockRejectedValue({ responseCode: 451 });
    for (let i = 0; i < 5; i++) {
      await db.reservationNoteMail.update({
        where: { id: mail.id },
        data: { nextAttemptAt: new Date(0) },
      });
      await service.sweep();
    }
    expect(
      await db.reservationNoteMail.findUnique({ where: { id: mail.id } }),
    ).toMatchObject({ status: 'FAILED', attempts: 5 });
    await service.sweep();
    expect(smtp.send).toHaveBeenCalledTimes(5);
  });
  it('never auto-resubmits an uncertain DATA result', async () => {
    const mail = await queue();
    smtp.send.mockRejectedValue({ code: 'ETIMEDOUT', command: 'DATA' });
    await service.sweep();
    await second.sweep();
    expect(smtp.send).toHaveBeenCalledTimes(1);
    expect(
      await db.reservationNoteMail.findUnique({ where: { id: mail.id } }),
    ).toMatchObject({ status: 'UNKNOWN' });
  });
  it('surfaces a crashed claim as unknown without resending', async () => {
    const mail = await queue();
    await db.reservationNoteMail.update({
      where: { id: mail.id },
      data: { status: 'SENDING', attempts: 1, updatedAt: new Date(0) },
    });
    await service.sweep();
    expect(smtp.send).not.toHaveBeenCalled();
    expect(
      await db.reservationNoteMail.findUnique({ where: { id: mail.id } }),
    ).toMatchObject({ status: 'UNKNOWN' });
  });
  it('does not send a queued note after cancellation', async () => {
    const mail = await queue();
    await db.reservationWorkflowRevision.create({
      data: {
        intakeId,
        version: ++version,
        actorUserId: userId,
        state: { supplierStatus: 'CANCELLED' },
      },
    });
    await service.sweep();
    expect(smtp.send).not.toHaveBeenCalled();
    expect(
      await db.reservationNoteMail.findUnique({ where: { id: mail.id } }),
    ).toMatchObject({ status: 'FAILED' });
  });
  it('does not send under a changed company identity', async () => {
    const mail = await queue();
    vi.stubEnv('RESERVATION_MAIL_LEGAL_ENTITY_ID', 'other-company');
    await service.sweep();
    expect(smtp.send).not.toHaveBeenCalled();
    expect(
      await db.reservationNoteMail.findUnique({ where: { id: mail.id } }),
    ).toMatchObject({ status: 'FAILED' });
  });
});
