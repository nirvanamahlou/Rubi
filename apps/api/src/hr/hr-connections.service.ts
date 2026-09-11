import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  HR_CONNECTION_TARGETS,
  getHrResource,
  type AuthenticatedActor,
  type HrConnectionDto,
  type HrConnectionList,
  type HrConnectionStatus,
  type HrConnectionTarget,
} from '@rubi/contracts';
import { Prisma } from '@rubi/database';
import { DatabaseService } from '../database/database.service';
import * as validate from './hr.validation';

type Tx = Prisma.TransactionClient;
type Row = Prisma.HrRecordGetPayload<{
  include: { employee: true; auditEvents: true };
}>;
interface SharedContent {
  title: string;
  message: string;
  sourceCode: string;
  sourceVersion: number;
  employeeLabel: string | null;
  requesterUserId: string;
  dueAt: string;
  response: string | null;
}
const pending = ['SUBMITTED', 'IN_REVIEW'];
const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export function canSendHrConnection(actor: AuthenticatedActor) {
  return (['hr.manage', 'hr.approve', 'hr.sensitive'] as const).every(
    (permission) => actor.permissions.includes(permission),
  );
}
export function hrReceivingTargets(actor: AuthenticatedActor) {
  return HR_CONNECTION_TARGETS.filter((target) =>
    actor.permissions.includes(`hr.connections.${target}.receive`),
  );
}
export function assertHrConnectionTransition(current: string, next: string) {
  const allowed: Record<string, string[]> = {
    SUBMITTED: ['IN_REVIEW', 'REJECTED', 'CANCELLED'],
    IN_REVIEW: ['ANSWERED', 'REJECTED', 'CANCELLED'],
  };
  if (!allowed[current]?.includes(next))
    throw new ConflictException(
      'ترتیب رسیدگی معتبر نیست؛ درخواست نهایی دوباره تغییر نمی‌کند.',
    );
}

/** Owns HR referrals only. A response never changes a destination financial/operational record. */
@Injectable()
export class HrConnectionsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  private scope(actor: AuthenticatedActor): Prisma.HrRecordWhereInput {
    const targets = hrReceivingTargets(actor);
    if (!canSendHrConnection(actor) && !targets.length)
      throw new ForbiddenException('مجوز ارتباطات منابع انسانی وجود ندارد.');
    return {
      section: 'connections',
      branchId: { in: actor.branchIds },
      deletedAt: null,
      tab: {
        in: canSendHrConnection(actor) ? [...HR_CONNECTION_TARGETS] : targets,
      },
    };
  }
  private async row(tx: Tx, id: string, actor: AuthenticatedActor) {
    const row = await tx.hrRecord.findFirst({
      where: { AND: [this.scope(actor), { id }] },
      include: {
        employee: true,
        auditEvents: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!row) throw new NotFoundException('درخواست در محدوده دسترسی پیدا نشد.');
    return row;
  }
  private mayRespond(row: Row, actor: AuthenticatedActor) {
    const data = row.data as unknown as SharedContent;
    return (
      hrReceivingTargets(actor).includes(row.tab as HrConnectionTarget) &&
      data.requesterUserId !== actor.userId &&
      row.employee?.userId !== actor.userId
    );
  }
  private dto(row: Row, actor: AuthenticatedActor): HrConnectionDto {
    const data = row.data as unknown as SharedContent;
    return {
      id: row.id,
      code: row.code,
      branchId: row.branchId,
      target: row.tab as HrConnectionTarget,
      title: data.title,
      message: data.message,
      sourceCode: data.sourceCode,
      sourceVersion: data.sourceVersion,
      sourceHref: canSendHrConnection(actor)
        ? `/hr?record=${encodeURIComponent(row.parentId!)}`
        : null,
      employeeLabel: data.employeeLabel,
      status: row.status as HrConnectionStatus,
      version: row.version,
      dueAt: data.dueAt,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      response: data.response,
      canRespond: pending.includes(row.status) && this.mayRespond(row, actor),
      canCancel:
        pending.includes(row.status) &&
        canSendHrConnection(actor) &&
        data.requesterUserId === actor.userId,
      history: row.auditEvents.map((event) => ({
        action: event.action,
        status: event.toStatus as HrConnectionStatus,
        note: (event.changes as { note: string }).note,
        occurredAt: event.createdAt.toISOString(),
      })),
    };
  }
  async list(
    input: Record<string, unknown>,
    actor: AuthenticatedActor,
  ): Promise<HrConnectionList> {
    validate.object(input, ['target', 'page', 'status']);
    const page = input.page === undefined ? 1 : Number(input.page);
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
      throw new BadRequestException('شماره صفحه معتبر نیست.');
    const target =
      input.target === undefined ? undefined : this.target(input.target);
    const states = [
      'SUBMITTED',
      'IN_REVIEW',
      'ANSWERED',
      'REJECTED',
      'CANCELLED',
    ];
    if (input.status !== undefined && !states.includes(String(input.status)))
      throw new BadRequestException('وضعیت معتبر نیست.');
    const base: Prisma.HrRecordWhereInput = {
      AND: [this.scope(actor), ...(target ? [{ tab: target }] : [])],
    };
    const where: Prisma.HrRecordWhereInput = {
      AND: [base, ...(input.status ? [{ status: String(input.status) }] : [])],
    };
    const [items, total, groups, overdue] =
      await this.database.client.$transaction([
        this.database.client.hrRecord.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * 25,
          take: 25,
          include: {
            employee: true,
            auditEvents: { orderBy: { createdAt: 'asc' } },
          },
        }),
        this.database.client.hrRecord.count({ where }),
        this.database.client.hrRecord.groupBy({
          by: ['status'],
          where: base,
          _count: { _all: true },
        }),
        this.database.client.hrRecord.count({
          where: {
            AND: [
              base,
              {
                status: { in: pending },
                data: { path: ['dueAt'], lt: new Date().toISOString() },
              },
            ],
          },
        }),
      ]);
    const counts: HrConnectionList['counts'] = {
      SUBMITTED: 0,
      IN_REVIEW: 0,
      ANSWERED: 0,
      REJECTED: 0,
      CANCELLED: 0,
      overdue,
    };
    for (const group of groups)
      counts[group.status as HrConnectionStatus] = group._count._all;
    // Read audit contains no personnel content and remains branch-scoped.
    if (actor.branchIds[0])
      await this.database.client.hrAuditEvent.create({
        data: {
          branchId: actor.branchIds[0],
          actorId: actor.userId,
          action: 'connection.list.read',
          changes: { target: target ?? 'all', count: items.length, page },
        },
      });
    return {
      items: items.map((row) => this.dto(row, actor)),
      total,
      page,
      pageSize: 25,
      canSend: canSendHrConnection(actor),
      targets: [...hrReceivingTargets(actor)],
      counts,
    };
  }
  private target(value: unknown): HrConnectionTarget {
    if (!HR_CONNECTION_TARGETS.includes(value as HrConnectionTarget))
      throw new BadRequestException('بخش مقصد معتبر نیست.');
    return value as HrConnectionTarget;
  }
  private async command(
    actor: AuthenticatedActor,
    keyInput: unknown,
    body: unknown,
    work: (tx: Tx) => Promise<{ id: string }>,
  ) {
    const key = validate.text(keyInput, 'کلید یکتای درخواست', 120);
    if (!/^[A-Za-z0-9._:-]{8,120}$/.test(key))
      throw new BadRequestException('کلید یکتای درخواست معتبر نیست.');
    const hash = createHash('sha256')
      .update(JSON.stringify(body))
      .digest('hex');
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.database.client.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${actor.userId + ':' + key}, 0))::text`;
            const receipt = await tx.hrCommand.findUnique({
              where: { actorId_key: { actorId: actor.userId, key } },
            });
            if (receipt) {
              if (receipt.hash !== hash)
                throw new ConflictException(
                  'این کلید با محتوای دیگری استفاده شده است.',
                );
              return receipt.result as { id: string };
            }
            const result = await work(tx);
            await tx.hrCommand.create({
              data: { actorId: actor.userId, key, hash, result },
            });
            return result;
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            timeout: 20000,
          },
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          ['P2034', 'P2002'].includes(error.code)
        ) {
          if (attempt < 2) continue;
          throw new ConflictException(
            'تغییر هم‌زمان انجام شده است؛ اطلاعات را تازه کنید.',
          );
        }
        throw error;
      }
    }
    throw new ConflictException('ثبت انجام نشد.');
  }
  async create(body: unknown, key: unknown, actor: AuthenticatedActor) {
    if (!canSendHrConnection(actor))
      throw new ForbiddenException(
        'ارسال نیازمند مجوز مدیریت، تأیید و اطلاعات حساس منابع انسانی است.',
      );
    const input = validate.object(body, [
      'target',
      'sourceId',
      'sourceVersion',
      'title',
      'message',
      'dueAt',
    ]);
    const target = this.target(input.target),
      sourceId = validate.uuid(input.sourceId),
      sourceVersion = validate.version(input.sourceVersion);
    const title = validate.text(input.title, 'عنوان', 160),
      message = validate.text(input.message, 'متن قابل اشتراک', 2000);
    const deadlineInput = validate.text(input.dueAt, 'مهلت', 30);
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(deadlineInput) ||
      !Number.isFinite(Date.parse(deadlineInput))
    )
      throw new BadRequestException('مهلت باید زمان UTC معتبر باشد.');
    validate.isoDate(deadlineInput.slice(0, 10), 'مهلت');
    const dueAt = new Date(deadlineInput).toISOString();
    if (dueAt.replace('.000Z', 'Z') !== deadlineInput.replace('.000Z', 'Z'))
      throw new BadRequestException('زمان مهلت معتبر نیست.');
    const result = await this.command(
      actor,
      key,
      {
        operation: 'connection.create.v1',
        target,
        sourceId,
        sourceVersion,
        title,
        message,
        dueAt,
      },
      async (tx) => {
        if (Date.parse(dueAt) <= Date.now())
          throw new BadRequestException('مهلت رسیدگی باید در آینده باشد.');
        const source = await tx.hrRecord.findFirst({
          where: {
            id: sourceId,
            branchId: { in: actor.branchIds },
            deletedAt: null,
            section: { not: 'connections' },
          },
          include: { employee: true },
        });
        if (!source) throw new NotFoundException('پرونده مبنا پیدا نشد.');
        if (source.version !== sourceVersion)
          throw new ConflictException(
            'پرونده مبنا تغییر کرده است؛ آخرین نسخه را انتخاب کنید.',
          );
        const schema = getHrResource(source.section, source.tab);
        if (
          !schema ||
          (schema.approval && !validate.APPROVED.has(source.status)) ||
          ['ردشده', 'لغوشده'].includes(source.status)
        )
          throw new ConflictException(
            'پرونده مبنا باید معتبر و در صورت نیاز تأییدشده باشد.',
          );
        if (
          await tx.hrRecord.count({
            where: {
              parentId: source.id,
              section: 'connections',
              tab: target,
              status: { in: pending },
              deletedAt: null,
            },
          })
        )
          throw new ConflictException(
            'درخواست باز برای این پرونده و مقصد وجود دارد.',
          );
        const data: SharedContent = {
          title,
          message,
          sourceCode: source.code,
          sourceVersion,
          employeeLabel: source.employee?.name ?? null,
          requesterUserId: actor.userId,
          dueAt,
          response: null,
        };
        const row = await tx.hrRecord.create({
          data: {
            branchId: source.branchId,
            employeeId: source.employeeId,
            parentId: source.id,
            code: `HR-LINK-${randomUUID().slice(0, 16).toUpperCase()}`,
            section: 'connections',
            tab: target,
            status: 'SUBMITTED',
            values: [],
            data: json(data),
            expiresAt: new Date(dueAt),
          },
        });
        await tx.hrAuditEvent.create({
          data: {
            branchId: row.branchId,
            actorId: actor.userId,
            recordId: row.id,
            employeeId: row.employeeId,
            action: 'connection.submit',
            version: 1,
            toStatus: 'SUBMITTED',
            changes: { note: message, target, sourceId, sourceVersion },
          },
        });
        return { id: row.id };
      },
    );
    return this.dto(
      await this.row(this.database.client, result.id, actor),
      actor,
    );
  }
  async decide(
    idInput: string,
    body: unknown,
    key: unknown,
    actor: AuthenticatedActor,
  ) {
    const id = validate.uuid(idInput),
      input = validate.object(body, ['version', 'status', 'note']);
    const version = validate.version(input.version),
      status = validate.text(input.status, 'وضعیت', 30),
      note = validate.text(input.note, 'توضیح نتیجه', 2000);
    this.scope(actor);
    // Recheck authorization even when replaying a previously successful command.
    const visible = await this.row(this.database.client, id, actor);
    const authorize = (row: Row) => {
      if (status === 'CANCELLED') {
        if (
          !canSendHrConnection(actor) ||
          (row.data as unknown as SharedContent).requesterUserId !==
            actor.userId
        )
          throw new ForbiddenException(
            'فقط فرستنده می‌تواند درخواست را لغو کند.',
          );
      } else if (!this.mayRespond(row, actor))
        throw new ForbiddenException(
          'مجوز پاسخ مقصد لازم است؛ پاسخ به درخواست خود یا مربوط به خود مجاز نیست.',
        );
    };
    authorize(visible);
    const result = await this.command(
      actor,
      key,
      { operation: 'connection.decide.v1', id, version, status, note },
      async (tx) => {
        const row = await this.row(tx, id, actor);
        authorize(row);
        if (row.version !== version)
          throw new ConflictException('درخواست هم‌زمان تغییر کرده است.');
        assertHrConnectionTransition(row.status, status);
        const data = row.data as unknown as SharedContent;
        const changed = await tx.hrRecord.updateMany({
          where: { id, version },
          data: {
            status,
            version: { increment: 1 },
            data: json({ ...data, response: note }),
          },
        });
        if (changed.count !== 1)
          throw new ConflictException('نسخه درخواست تغییر کرده است.');
        await tx.hrAuditEvent.create({
          data: {
            branchId: row.branchId,
            actorId: actor.userId,
            recordId: id,
            employeeId: row.employeeId,
            action: 'connection.respond',
            version: version + 1,
            fromStatus: row.status,
            toStatus: status,
            changes: { note },
          },
        });
        await tx.hrNotification.create({
          data: {
            branchId: row.branchId,
            targetUserId: data.requesterUserId,
            recordId: row.parentId,
            action: 'connection.response',
            title: 'وضعیت درخواست بین‌بخشی منابع انسانی تغییر کرد',
          },
        });
        return { id };
      },
    );
    return this.dto(
      await this.row(this.database.client, result.id, actor),
      actor,
    );
  }
}
