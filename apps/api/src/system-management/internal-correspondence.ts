import { createHash } from 'node:crypto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { isDeepStrictEqual } from 'node:util';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Header,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  StreamableFile,
} from '@nestjs/common';
import type {
  InternalLetterContent,
  InternalLetterStatus,
} from '@nora/contracts';
import { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import { AuthGuard } from '../iam/auth.guard';
import { PermissionGuard } from '../iam/permission.guard';
import { RequireAccessControls } from '../iam/iam.decorators';
import { IamCorrespondenceDirectory } from '../iam/iam-correspondence-directory';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { correspondenceDateParts } from './correspondence-numbering';

const maxAttachmentCount = 5;
const maxAttachmentBytes = 10 * 1024 * 1024;
type LetterFile = { originalname: string; buffer: Buffer; size: number };

function attachmentRecords(files: readonly LetterFile[]) {
  if (
    files.length > maxAttachmentCount ||
    files.some((file) => file.size > maxAttachmentBytes)
  )
    throw new BadRequestException('حجم یا تعداد پیوست‌ها بیش از حد مجاز است.');
  return files.map((file, ordinal) => {
    const decoded = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const name =
      Array.from(decoded.includes('�') ? file.originalname : decoded)
        .map((character) => {
          const code = character.charCodeAt(0);
          return code < 32 ||
            code === 127 ||
            character === '/' ||
            character === '\\'
            ? '_'
            : character;
        })
        .slice(0, 255)
        .join('')
        .trim() || 'attachment';
    return {
      name,
      ordinal,
      size: file.size,
      bytes: Uint8Array.from(file.buffer),
      digest: createHash('sha256').update(file.buffer).digest('hex'),
    };
  });
}

const identity = { id: true, displayName: true, username: true } as const;
const statuses = ['SENT', 'APPROVED', 'REJECTED', 'NEEDS_CORRECTION'] as const;
const companyIds: Record<string, string> = {
  'نیایش سیر': 'NIAYESH',
  'جهان باستان': 'JAHAN',
  'قسطی روو': 'GHESTI',
};
export function correspondenceUuid(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new BadRequestException('شناسه نامه یا کاربر معتبر نیست.');
  return value.toLowerCase();
}
function object(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new BadRequestException('اطلاعات نامه معتبر نیست.');
  return input as Record<string, unknown>;
}
export function correspondenceRecipients(
  input: Record<string, unknown>,
): string[] {
  const values =
    input.recipientIds ?? (input.recipientId ? [input.recipientId] : []);
  if (!Array.isArray(values) || !values.length || values.length > 100)
    throw new BadRequestException('بین یک تا صد گیرنده انتخاب کنید.');
  return [...new Set(values.map(correspondenceUuid))].sort();
}
function forwardingDescription(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.length > 2000 || value.includes('\0'))
    throw new BadRequestException('توضیحات بازارسال معتبر نیست.');
  return value.trim();
}
function sameRecipients(rows: { recipientId: string }[], targets: string[]) {
  return isDeepStrictEqual(rows.map((r) => r.recipientId).sort(), targets);
}
export function internalLetterContent(input: unknown): InternalLetterContent {
  const source = object(input);
  const result: Record<string, string> = {};
  const lengths = {
    company: 80,
    recipient: 160,
    recipientTitle: 160,
    sender: 160,
    subject: 160,
    date: 40,
    number: 100,
    attachment: 80,
    signer: 80,
    text: 20000,
    template: 10000,
  };
  for (const [key, max] of Object.entries(lengths)) {
    const value = source[key] ?? '';
    if (typeof value !== 'string' || value.length > max)
      throw new BadRequestException('اطلاعات نامه معتبر نیست.');
    result[key] = value.trim();
  }
  if (
    !Object.hasOwn(companyIds, result.company!) ||
    [
      'recipient',
      'sender',
      'subject',
      'date',
      'number',
      'text',
      'template',
    ].some((key) => !result[key])
  )
    throw new BadRequestException(
      'گیرنده، فرستنده، موضوع و متن نامه را تکمیل کنید.',
    );
  if (!result.template!.includes('{{متن}}'))
    throw new BadRequestException('قالب باید متغیر {{متن}} را داشته باشد.');
  const allowed = new Set([
    'متن',
    'امضا',
    'شرکت',
    'گیرنده',
    'مخاطب',
    'فرستنده',
    'موضوع',
    'تاریخ',
    'شماره',
    'پیوست',
  ]);
  for (const match of result.template!.matchAll(/\{\{([^{}]+)\}\}/g))
    if (!allowed.has(match[1]!))
      throw new BadRequestException('متغیر قالب نامه معتبر نیست.');
  return result as unknown as InternalLetterContent;
}
function version(value: unknown) {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new BadRequestException('نسخه نامه معتبر نیست.');
  return value as number;
}
const participant = (actor: string) => ({
  OR: [
    { authorId: actor },
    {
      deliveries: {
        some: { OR: [{ recipientId: actor }, { senderId: actor }] },
      },
    },
  ],
});

@Injectable()
export class InternalCorrespondenceService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(IamCorrespondenceDirectory)
    private readonly directory: IamCorrespondenceDirectory,
  ) {}

  users() {
    return this.directory.list();
  }
  currentUser(actor: string) {
    return this.directory.resolve(actor);
  }
  private audit(
    tx: Prisma.TransactionClient,
    actor: string,
    id: string,
    action: string,
    after: Prisma.InputJsonObject = {},
  ) {
    // Audit retains event metadata only; hard deletion removes the letter body and all deliveries.
    return tx.systemAuditEvent.create({
      data: {
        actorUserId: actor,
        action: `correspondence.${action}`,
        entityType: 'internal-letter',
        entityId: id,
        outcome: 'SUCCESS',
        reason: '',
        after,
      },
    });
  }
  async list(actor: string, query: Record<string, string | undefined>) {
    if (
      Object.values(query).some(
        (value) => typeof value !== 'string' && value !== undefined,
      )
    )
      throw new BadRequestException('فیلتر نامه معتبر نیست.');
    const page = Number(query.page ?? 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000)
      throw new BadRequestException('صفحه معتبر نیست.');
    const pageSize = 25;
    if (
      query.status &&
      !statuses.includes(query.status as InternalLetterStatus)
    )
      throw new BadRequestException('وضعیت نامه معتبر نیست.');
    const base = { recipientId: actor };
    const where: Prisma.CorrespondenceDeliveryWhereInput = {
      ...base,
      ...(query.status ? { status: query.status } : {}),
      ...(query.unread === 'true' ? { readAt: null } : {}),
      ...(query.senderId
        ? { senderId: correspondenceUuid(query.senderId) }
        : {}),
      letter: {
        ...(query.company
          ? { content: { path: ['company'], equals: query.company } }
          : {}),
        ...(query.search
          ? {
              OR: [
                {
                  number: {
                    contains: query.search.slice(0, 160),
                    mode: 'insensitive',
                  },
                },
                {
                  content: {
                    path: ['subject'],
                    string_contains: query.search.slice(0, 160),
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
      },
    };
    return this.database.client.$transaction(
      async (tx) => {
        const [rows, total, all, unread, approved, needsCorrection] =
          await Promise.all([
            tx.correspondenceDelivery.findMany({
              where,
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              skip: (page - 1) * pageSize,
              take: pageSize,
              include: {
                sender: { select: identity },
                recipient: { select: identity },
                letter: { include: { author: { select: identity } } },
              },
            }),
            tx.correspondenceDelivery.count({ where }),
            tx.correspondenceDelivery.count({ where: base }),
            tx.correspondenceDelivery.count({
              where: { ...base, readAt: null },
            }),
            tx.correspondenceDelivery.count({
              where: { ...base, status: 'APPROVED' },
            }),
            tx.correspondenceDelivery.count({
              where: { ...base, status: 'NEEDS_CORRECTION' },
            }),
          ]);
        return {
          contract: 'correspondence.internal.v1',
          items: rows.map(({ letter, ...delivery }) => ({
            id: letter.id,
            version: letter.version,
            dateISO: letter.dateISO,
            createdAt: letter.createdAt,
            updatedAt: letter.updatedAt,
            author: letter.author,
            letter: letter.content,
            delivery,
          })),
          total,
          page,
          pageSize,
          kpis: { total: all, unread, approved, needsCorrection },
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async detail(actor: string, id: string) {
    const row = await this.database.client.correspondenceLetter.findFirst({
      where: { id: correspondenceUuid(id), ...participant(actor) },
      include: {
        author: { select: identity },
        attachments: {
          select: { id: true, name: true, size: true },
          orderBy: { ordinal: 'asc' },
        },
        deliveries: {
          where: { OR: [{ recipientId: actor }, { senderId: actor }] },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1,
          include: {
            sender: { select: identity },
            recipient: { select: identity },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('نامه یافت نشد.');
    const { content, deliveries, ...rest } = row;
    return { ...rest, letter: content, delivery: deliveries[0] };
  }
  async attachment(actor: string, letterId: string, id: string) {
    const file = await this.database.client.correspondenceAttachment.findFirst({
      where: {
        id: correspondenceUuid(id),
        letterId: correspondenceUuid(letterId),
        letter: participant(actor),
      },
      select: { name: true, bytes: true },
    });
    if (!file) throw new NotFoundException('پیوست نامه یافت نشد.');
    return file;
  }

  async send(actor: string, body: unknown, files: readonly LetterFile[] = []) {
    const input = object(body),
      draft = object(input.letter),
      targets = correspondenceRecipients(input),
      key = correspondenceUuid(input.requestKey);
    const addressed =
      input.addressedUserId === undefined
        ? null
        : correspondenceUuid(input.addressedUserId);
    if (addressed && !targets.includes(addressed))
      throw new BadRequestException('گیرندهٔ نامه باید در فهرست ارسال باشد.');
    const attachments = attachmentRecords(files);
    const dateISO = input.dateISO;
    if (
      typeof dateISO !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(dateISO) ||
      !Number.isFinite(Date.parse(`${dateISO}T12:00:00Z`)) ||
      new Date(`${dateISO}T12:00:00Z`).toISOString().slice(0, 10) !== dateISO
    )
      throw new BadRequestException('تاریخ نامه معتبر نیست.');
    return this.database.client.$transaction(
      async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${actor + key},0))`,
        );
        await tx.$queryRaw(
          Prisma.sql`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${'internal-letter-number:' + (typeof draft.number === 'string' ? draft.number.trim().slice(0, 100) : '')},0))`,
        );
        const replays = await tx.correspondenceDelivery.findMany({
          where: { senderId: actor, requestKey: key },
        });
        if (replays.length) {
          const replay = replays[0]!;
          const original = await tx.correspondenceLetter.findUnique({
            where: { id: replay.letterId },
            include: {
              attachments: {
                select: { name: true, size: true, digest: true },
                orderBy: { ordinal: 'asc' },
              },
            },
          });
          const originalContent = original?.content as
            (InternalLetterContent & { addressedUserId?: string }) | undefined;
          const retry = internalLetterContent(
            addressed && originalContent
              ? {
                  ...draft,
                  recipient: originalContent.recipient,
                  recipientTitle: originalContent.recipientTitle,
                  sender: originalContent.sender,
                }
              : draft,
          );
          if (
            (originalContent?.addressedUserId ?? null) !== addressed ||
            !sameRecipients(replays, targets) ||
            original?.dateISO !== dateISO ||
            !isDeepStrictEqual(
              original?.content,
              addressed ? { ...retry, addressedUserId: addressed } : retry,
            ) ||
            !isDeepStrictEqual(
              original?.attachments,
              attachments.map(({ name, size, digest }) => ({
                name,
                size,
                digest,
              })),
            )
          )
            throw new ConflictException('شناسه ارسال تکراری است.');
          return { id: replay.letterId };
        }
        const directory = new Map<
          string,
          Awaited<ReturnType<IamCorrespondenceDirectory['resolve']>>
        >();
        for (const target of targets)
          directory.set(target, await this.directory.resolve(target, tx));
        const recipient = addressed ? directory.get(addressed) : undefined;
        const letter = internalLetterContent(
          recipient
            ? {
                ...draft,
                recipient: recipient.displayName,
                recipientTitle: recipient.jobTitle,
                sender: (
                  directory.get(actor) ??
                  (await this.directory.resolve(actor, tx))
                ).displayName,
              }
            : draft,
        );
        const number = await tx.systemIssuedNumber.findFirst({
          where: {
            issuedValue: letter.number,
            actorUserId: actor,
            scheme: {
              code: `CORRESPONDENCE_OUTGOING_${companyIds[letter.company]}`,
            },
          },
        });
        if (!number)
          throw new BadRequestException(
            'شماره نامه برای این کاربر صادر نشده است.',
          );
        const expectedDate = correspondenceDateParts(
          new Date(`${dateISO}T12:00:00+03:30`),
        ).join('/');
        const normalizedDate = letter.date.replace(/[۰-۹]/g, (digit) =>
          String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)),
        );
        if (
          number.issuedValue.split('/').slice(1, 4).join('/') !==
            expectedDate ||
          normalizedDate !== expectedDate
        )
          throw new BadRequestException('تاریخ و شماره نامه مطابقت ندارند.');
        const existing = await tx.correspondenceLetter.findUnique({
          where: { number: letter.number },
        });
        if (existing)
          throw new ConflictException('این نامه قبلاً ارسال شده است.');
        const row = await tx.correspondenceLetter.create({
          data: {
            authorId: actor,
            number: letter.number,
            dateISO,
            content: {
              ...letter,
              ...(addressed ? { addressedUserId: addressed } : {}),
            },
            ...(attachments.length
              ? { attachments: { create: attachments } }
              : {}),
            deliveries: {
              create: targets.map((target) => ({
                senderId: actor,
                recipientId: target,
                status: 'SENT',
                requestKey: key,
              })),
            },
          },
        });
        await this.audit(tx, actor, row.id, 'send', { recipientIds: targets });
        return { id: row.id };
      },
      { timeout: 30000 },
    );
  }
  private async lock(
    tx: Prisma.TransactionClient,
    actor: string,
    id: string,
    expected: unknown,
  ) {
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM correspondence_letters WHERE id=${correspondenceUuid(id)}::uuid FOR UPDATE`,
    );
    const row = await tx.correspondenceLetter.findFirst({
      where: { id, ...participant(actor) },
    });
    if (!row) throw new NotFoundException('نامه یافت نشد.');
    if (row.version !== version(expected))
      throw new ConflictException('نامه تغییر کرده است؛ دوباره بارگذاری کنید.');
    return row;
  }
  async edit(actor: string, id: string, body: unknown) {
    const input = object(body),
      letter = internalLetterContent(input.letter);
    return this.database.client.$transaction(async (tx) => {
      const row = await this.lock(tx, actor, id, input.version);
      const previous = row.content as unknown as InternalLetterContent;
      if (
        letter.number !== row.number ||
        letter.company !== previous.company ||
        letter.date !== previous.date
      )
        throw new BadRequestException(
          'شماره، تاریخ و شرکت نامه قابل تغییر نیست.',
        );
      const updated = await tx.correspondenceLetter.update({
        where: { id },
        data: {
          content: letter as unknown as Prisma.InputJsonObject,
          version: { increment: 1 },
        },
      });
      await this.audit(tx, actor, id, 'edit', { version: updated.version });
      return { id, version: updated.version };
    });
  }
  async forward(actor: string, id: string, body: unknown) {
    const input = object(body),
      targets = correspondenceRecipients(input),
      key = correspondenceUuid(input.requestKey);
    const description = forwardingDescription(input.description);
    if (
      !['APPROVED', 'REJECTED', 'NEEDS_CORRECTION'].includes(
        String(input.status),
      )
    )
      throw new BadRequestException('وضعیت نامه معتبر نیست.');
    return this.database.client.$transaction(
      async (tx) => {
        // Lock before replay lookup so parallel retries cannot both create a delivery.
        await tx.$queryRaw(
          Prisma.sql`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${actor + key},0))`,
        );
        const replays = await tx.correspondenceDelivery.findMany({
          where: { senderId: actor, requestKey: key },
        });
        if (replays.length) {
          const replay = replays[0]!;
          if (
            replay.letterId !== id ||
            !sameRecipients(replays, targets) ||
            replays.some(
              (row) =>
                row.letterId !== id ||
                row.status !== input.status ||
                (row.description ?? '') !== description,
            )
          )
            throw new ConflictException('شناسه ارسال تکراری است.');
          return { id };
        }
        await this.lock(tx, actor, id, input.version);
        for (const target of targets) await this.directory.resolve(target, tx);
        await tx.correspondenceDelivery.updateMany({
          where: { letterId: id, recipientId: actor },
          data: { status: input.status as string },
        });
        for (const target of targets)
          await tx.correspondenceDelivery.upsert({
            where: {
              letterId_recipientId: { letterId: id, recipientId: target },
            },
            create: {
              letterId: id,
              senderId: actor,
              recipientId: target,
              status: input.status as string,
              requestKey: key,
              description: description || null,
            },
            update: {
              senderId: actor,
              status: input.status as string,
              requestKey: key,
              readAt: null,
              description: description || null,
              createdAt: new Date(),
            },
          });
        await tx.correspondenceLetter.update({
          where: { id },
          data: { version: { increment: 1 } },
        });
        await this.audit(tx, actor, id, 'forward', {
          recipientIds: targets,
          status: input.status as string,
        });
        return { id };
      },
      { timeout: 30000 },
    );
  }
  async read(actor: string, id: string) {
    await this.detail(actor, id);
    await this.database.client.correspondenceDelivery.updateMany({
      where: { letterId: id, recipientId: actor, readAt: null },
      data: { readAt: new Date() },
    });
    return { id };
  }
  async remove(actor: string, id: string, body: unknown) {
    const input = object(body);
    return this.database.client.$transaction(async (tx) => {
      await this.lock(tx, actor, id, input.version);
      await tx.correspondenceLetter.delete({ where: { id } });
      await this.audit(tx, actor, id, 'delete');
      return { id };
    });
  }
}

@Controller('correspondence/v1/internal')
@UseGuards(AuthGuard, PermissionGuard)
@RequireAccessControls('correspondence.home')
export class InternalCorrespondenceController {
  constructor(
    @Inject(InternalCorrespondenceService)
    private readonly service: InternalCorrespondenceService,
  ) {}
  @Get('users') @Header('Cache-Control', 'private, no-store') users() {
    return this.service.users();
  }
  @Get('me')
  @Header('Cache-Control', 'private, no-store')
  me(@Req() req: AuthenticatedRequest) {
    return this.service.currentUser(req.actor.userId);
  }
  @Post('with-attachments')
  @UseInterceptors(
    FilesInterceptor('files', maxAttachmentCount, {
      limits: { fileSize: maxAttachmentBytes, fields: 1, fieldSize: 64 * 1024 },
    }),
  )
  sendWithAttachments(
    @Req() req: AuthenticatedRequest,
    @Body('letter') raw: string,
    @UploadedFiles() files: LetterFile[],
  ) {
    let body: unknown;
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      throw new BadRequestException('اطلاعات نامه معتبر نیست.');
    }
    return this.service.send(req.actor.userId, body, files);
  }
  @Get(':letterId/attachments/:id')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async attachment(
    @Req() req: AuthenticatedRequest,
    @Param('letterId') letterId: string,
    @Param('id') id: string,
  ) {
    const file = await this.service.attachment(req.actor.userId, letterId, id);
    return new StreamableFile(file.bytes, {
      type: 'application/octet-stream',
      disposition: `attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/['()*]/g, (char) => '%' + char.charCodeAt(0).toString(16))}`,
    });
  }
  @Get() @Header('Cache-Control', 'private, no-store') list(
    @Req() req: AuthenticatedRequest,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.service.list(req.actor.userId, query);
  }
  @Post() send(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.service.send(req.actor.userId, body);
  }
  @Get(':id') @Header('Cache-Control', 'private, no-store') detail(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.service.detail(req.actor.userId, id);
  }
  @Patch(':id') edit(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.edit(req.actor.userId, id, body);
  }
  @Post(':id/read') read(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.service.read(req.actor.userId, id);
  }
  @Post(':id/forward') forward(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.forward(req.actor.userId, id, body);
  }
  @Delete(':id') remove(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.remove(req.actor.userId, id, body);
  }
}
