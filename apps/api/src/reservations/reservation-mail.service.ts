import { randomUUID } from 'node:crypto';
import {
  verifyReservationPdf,
  type SignedReservationPdf,
} from './reservation-mail-pdf';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  TravelWorkflowCommandV1,
  TravelWorkflowStateV1,
} from '@nora/contracts';
import { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import { MasterDataService } from '../master-data/master-data.service';
import { MasterTravelDirectory } from '../master-data/master-travel-directory';
import { NotificationsService } from '../notifications/notifications.service';
import {
  mailbox,
  mailConfiguration,
  mailFailure,
  sendNoteMail,
  type NoteMail,
} from '../integrations/reservation-mail/smtp';
import {
  mailKey,
  openMail,
  reservationNoteIntent,
  sealMail,
} from './reservation-note-mail';

type PreparedMail = { id: string; contactId: string; envelope: string };
type ClaimedMail = {
  id: string;
  envelope: string;
  actorUserId: string;
  attempts: number;
  intakeId: string;
};

@Injectable()
export class ReservationMailService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(ReservationMailService.name);
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(MasterDataService) private readonly master: MasterDataService,
    @Inject(MasterTravelDirectory)
    private readonly directory: MasterTravelDirectory,
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
  ) {}

  async prepare(
    state: TravelWorkflowStateV1,
    command: TravelWorkflowCommandV1,
    actor: AuthenticatedActor,
    branchId: string,
    contractNumber: string,
    legalEntityId: string | undefined,
    pdf: SignedReservationPdf | undefined,
    intakeId: string,
  ): Promise<PreparedMail> {
    let config;
    let key;
    try {
      config = mailConfiguration(process.env);
      key = mailKey(process.env.RESERVATION_MAIL_KEY_BASE64);
      if (
        !config ||
        !legalEntityId ||
        legalEntityId !== process.env.RESERVATION_MAIL_LEGAL_ENTITY_ID
      )
        throw new Error('NOT_READY');
    } catch {
      throw new ServiceUnavailableException(
        'اتصال ایمیل رزرواسیون شرکت هنوز آماده نشده است.',
      );
    }
    let intent;
    try {
      intent = reservationNoteIntent(state, command);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    let bytes: Buffer;
    try {
      bytes = verifyReservationPdf(
        pdf,
        intakeId,
        command.expectedVersion,
        command.hotelStayKey,
        process.env.RESERVATION_PDF_MAIL_SECRET,
      );
    } catch {
      throw new BadRequestException(
        'PDF معتبر فرم رزرواسیون برای ارسال دریافت نشد.',
      );
    }
    const broker = await this.directory.brokerReference(intent.brokerId);
    const { data: partner } = await this.master.detail(
      broker.source === 'BROKER' ? 'brokers' : 'organizations',
      broker.id,
    );
    const organizationId =
      broker.source === 'ORGANIZATION'
        ? broker.id
        : String(partner.attributes.organizationId ?? '');
    if (!organizationId)
      throw new BadRequestException(
        'ایمیل کارگزار را در پرونده اطلاعات پایه تکمیل کنید.',
      );
    const contacts = await this.master.list('organization-contacts', {
      search: '',
      organizationId,
      status: 'active',
      page: 1,
      pageSize: 100,
      sortBy: 'name',
      sortDirection: 'asc',
    });
    // The dossier's explicit email contact is authoritative. Never pick an arbitrary person.
    const candidates = contacts.data.filter(
      (c) => c.attributes.jobTitle === 'PARTNER_EMAIL',
    );
    if (contacts.meta.total > 100 || candidates.length !== 1)
      throw new BadRequestException(
        'یک ایمیل مشخص برای کارگزار در پرونده اطلاعات پایه ثبت کنید.',
      );
    const contact = candidates[0]!;
    const { data } = await this.master.unmaskOrganizationContact(
      contact.id,
      actor,
      branchId,
    );
    let to;
    try {
      to = mailbox(data.email ?? '');
    } catch {
      throw new BadRequestException('ایمیل ثبت‌شده کارگزار معتبر نیست.');
    }
    const id = randomUUID();
    const subject = `Reservation / ${contractNumber.replace(/[\r\n\0]/g, ' ').slice(0, 100)}`;
    return {
      id,
      contactId: contact.id,
      envelope: sealMail(
        {
          id,
          to,
          subject,
          pdfBase64: bytes.toString('base64'),
          filename: `reservation-form-${contractNumber.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 100)}.pdf`,
          scope: intent.scope,
          brokerId: intent.brokerId,
          from: config.from,
          fromName: config.fromName,
          replyTo: config.replyTo,
          legalEntityId,
        },
        key,
        id,
      ),
    };
  }

  async enqueue(
    tx: Prisma.TransactionClient,
    prepared: PreparedMail,
    revisionId: string,
  ) {
    await tx.$executeRaw(Prisma.sql`INSERT INTO "reservation_note_mail" ("id", "revisionId", "contactId", "envelope")
      VALUES (${prepared.id}::uuid, ${revisionId}::uuid, ${prepared.contactId}::uuid, ${prepared.envelope})`);
  }

  onModuleInit() {
    if (process.env.RESERVATION_MAIL_ENABLED !== 'true') return;
    this.timer = setInterval(() => {
      void this.sweep();
    }, 5000);
    this.timer.unref();
    void this.sweep();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async sweep() {
    if (this.running) return;
    this.running = true;
    try {
      const config = mailConfiguration(process.env);
      if (!config) return;
      const key = mailKey(process.env.RESERVATION_MAIL_KEY_BASE64);
      // A crashed process may have submitted DATA: surface uncertainty, never resubmit.
      await this.database.client.$transaction(async (tx) => {
        const stale = await tx.$queryRaw<
          { id: string; actorUserId: string }[]
        >(Prisma.sql`
          UPDATE "reservation_note_mail" m SET "status"='UNKNOWN', "updatedAt"=now()
          FROM "ReservationWorkflowRevision" r WHERE m."revisionId"=r."id"
          AND m."status"='SENDING' AND m."updatedAt" < now()-interval '5 minutes'
          RETURNING m."id", r."actorUserId"`);
        for (const row of stale) await this.notice(tx, row, 'UNKNOWN');
      });
      const rows = await this.database.client.$transaction(async (tx) =>
        tx.$queryRaw<ClaimedMail[]>(Prisma.sql`
        WITH candidate AS (
          SELECT "id" FROM "reservation_note_mail" WHERE "status" IN ('QUEUED','RETRY') AND "nextAttemptAt"<=now()
          ORDER BY "createdAt", "id" FOR UPDATE SKIP LOCKED LIMIT 1
        ) UPDATE "reservation_note_mail" m SET "status"='SENDING', "attempts"=m."attempts"+1, "updatedAt"=now()
        FROM candidate c, "ReservationWorkflowRevision" r WHERE m."id"=c."id" AND r."id"=m."revisionId"
        RETURNING m."id", m."envelope", m."attempts", r."actorUserId", r."intakeId"`),
      );
      const row = rows[0];
      if (!row) return;
      let status: 'ACCEPTED' | 'RETRY' | 'FAILED' | 'UNKNOWN';
      try {
        const latest =
          await this.database.client.reservationWorkflowRevision.findFirst({
            where: { intakeId: row.intakeId },
            orderBy: { version: 'desc' },
            select: { state: true },
          });
        if (
          !latest ||
          (latest.state as unknown as TravelWorkflowStateV1).supplierStatus ===
            'CANCELLED'
        )
          throw Object.assign(new Error('RESERVATION_CANCELLED'), {
            responseCode: 550,
          });
        const payload = openMail(row.envelope, key, row.id) as NoteMail & {
          from: string;
          fromName: string;
          replyTo: string;
          legalEntityId: string;
        };
        if (
          payload.id !== row.id ||
          payload.from !== config.from ||
          payload.fromName !== config.fromName ||
          payload.replyTo !== config.replyTo ||
          payload.legalEntityId !== process.env.RESERVATION_MAIL_LEGAL_ENTITY_ID
        )
          throw Object.assign(new Error('SENDER_CHANGED'), {
            responseCode: 550,
          });
        await sendNoteMail(config, payload);
        status = 'ACCEPTED';
      } catch (error) {
        status = mailFailure(error);
        if (status === 'RETRY' && row.attempts >= 5) status = 'FAILED';
      }
      await this.database.client.$transaction(async (tx) => {
        const changed =
          await tx.$executeRaw(Prisma.sql`UPDATE "reservation_note_mail" SET "status"=${status},
          "nextAttemptAt"=now()+(${Math.min(3600, 30 * 2 ** row.attempts)} * interval '1 second'), "updatedAt"=now()
          WHERE "id"=${row.id}::uuid AND "status"='SENDING'`);
        if (changed && status !== 'RETRY') await this.notice(tx, row, status);
      });
    } catch {
      this.logger.warn(
        'Reservation mail dispatch unavailable; durable records retained.',
      );
    } finally {
      this.running = false;
    }
  }

  private async notice(
    tx: Prisma.TransactionClient,
    row: { id: string; actorUserId: string },
    status: string,
  ) {
    const context = await tx.$queryRaw<{ contractNumber: string }[]>(Prisma.sql`
      SELECT i."snapshot"->>'contractNumber' AS "contractNumber"
      FROM "reservation_note_mail" m JOIN "ReservationWorkflowRevision" r ON r."id"=m."revisionId"
      JOIN "ReservationIntake" i ON i."id"=r."intakeId" WHERE m."id"=${row.id}::uuid`);
    const contractNumber = context[0]?.contractNumber ?? '';
    await this.notifications.createWithinTransaction(tx, {
      recipientUserIds: [row.actorUserId],
      actorUserId: row.actorUserId,
      sourceModule: 'reservations',
      eventType: 'RESERVATION_NOTE_MAIL',
      title:
        status === 'ACCEPTED'
          ? 'ایمیل فرم رزرواسیون توسط سرویس ایمیل پذیرفته شد'
          : status === 'UNKNOWN'
            ? 'نتیجه ارسال ایمیل فرم رزرواسیون نامشخص است'
            : 'ارسال ایمیل فرم رزرواسیون انجام نشد',
      message:
        contractNumber +
        '\n' +
        (status === 'ACCEPTED'
          ? 'این وضعیت به معنی تأیید یا خوانده‌شدن توسط کارگزار نیست.'
          : 'پیش از ارسال مجدد، وضعیت را با مسئول رزرواسیون بررسی کنید.'),
      entityType: 'reservation_note_mail',
      entityId: row.id,
      href: '/reservations',
    });
  }
}
