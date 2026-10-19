import { IamWorkbenchRequestDirectory } from '../iam/iam-workbench-request-directory';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import { DatabaseService } from '../database/database.service';
import {
  callCenterTaskFilter,
  callCenterTaskReport,
  callCenterTaskRevision,
} from '../tasks/call-center-read';
import { CallCenterWorkflowService } from './call-center-workflow.service';
import { CallCenterService, normalizedCallPhone } from './call-center.service';
import { CallCenterCrypto } from './call-center.crypto';
import { callSearchToken, normalizeCallSearch } from './call-center-search';
import type {
  CallCenterSearchDto,
  CallCenterHistoryDto,
} from './call-center-search.dto';

export function tehranDay(now: Date) {
  // Iran has used fixed UTC+03:30 since 2023; Intl supplies the displayed calendar date.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (key: string) => parts.find((p) => p.type === key)!.value;
  return new Date(
    `${part('year')}-${part('month')}-${part('day')}T00:00:00+03:30`,
  );
}
@Injectable()
export class CallCenterReadService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(CallCenterWorkflowService)
    private readonly workflow: CallCenterWorkflowService,
    @Inject(CallCenterService) private readonly calls: CallCenterService,
    @Inject(CallCenterCrypto) private readonly crypto: CallCenterCrypto,
    @Inject(IamWorkbenchRequestDirectory)
    private readonly directory: IamWorkbenchRequestDirectory,
  ) {}
  private conditions(
    branch: string,
    q: CallCenterSearchDto,
    teamUsers?: string[],
  ) {
    const terms: Prisma.Sql[] = [Prisma.sql`c.branch_id=${branch}::uuid`];
    if (q.from && q.to && new Date(q.from) >= new Date(q.to))
      throw new BadRequestException('بازه زمانی معتبر نیست.');
    if (q.from) terms.push(Prisma.sql`a.occurred_at >= ${new Date(q.from)}`);
    if (q.to) terms.push(Prisma.sql`a.occurred_at < ${new Date(q.to)}`);
    if (q.direction) terms.push(Prisma.sql`a.direction=${q.direction}`);
    if (q.outcome)
      terms.push(
        q.outcome === 'UNKNOWN'
          ? Prisma.sql`a.outcome IS NULL`
          : Prisma.sql`a.outcome=${q.outcome}`,
      );
    if (q.origin)
      terms.push(
        q.origin === 'UNKNOWN'
          ? Prisma.sql`a.origin IS NULL`
          : Prisma.sql`a.origin=${q.origin}`,
      );
    if (teamUsers)
      terms.push(
        teamUsers.length
          ? Prisma.sql`a.created_by_user_id IN (${Prisma.join(teamUsers.map((id) => Prisma.sql`${id}::uuid`))})`
          : Prisma.sql`FALSE`,
      );
    if (q.agentId)
      terms.push(Prisma.sql`a.created_by_user_id=${q.agentId}::uuid`);
    if (q.source)
      terms.push(
        Prisma.sql`a.source_token=${callSearchToken(this.crypto, branch, 'source', q.source)}`,
      );
    if (q.unit)
      terms.push(
        Prisma.sql`a.unit_token=${callSearchToken(this.crypto, branch, 'unit', q.unit)}`,
      );
    if (q.incomplete)
      terms.push(Prisma.sql`a.needs_completion=${q.incomplete === 'YES'}`);
    const query = q.query?.trim();
    if (query) {
      if (/^[+\d۰-۹٠-٩\s()-]+$/.test(query))
        terms.push(
          Prisma.sql`c.phone_fingerprint=${this.crypto.fingerprint(normalizedCallPhone(query))}`,
        );
      else {
        const words = normalizeCallSearch(query).split(' ').filter(Boolean);
        if (!words.length || words.length > 12)
          throw new BadRequestException('یک تا دوازده کلمه کامل وارد کنید.');
        const tokens = words.map((w) =>
          callSearchToken(this.crypto, branch, 'word', w),
        );
        terms.push(
          Prisma.sql`a.search_tokens @> ARRAY[${Prisma.join(tokens)}]::text[]`,
        );
      }
    }
    if (q.requestStatus)
      terms.push(
        Prisma.sql`EXISTS(SELECT 1 FROM customer_affairs_tickets r WHERE r.call_center_contact_id=c.id AND r.branch_id=c.branch_id AND r.status=${q.requestStatus} AND r.category='CALL_CENTER_REQUEST')`,
      );
    const now = new Date();
    if (q.followUp)
      terms.push(
        Prisma.sql`EXISTS(SELECT 1 FROM customer_affairs_tickets r WHERE r.call_center_contact_id=c.id AND r.branch_id=c.branch_id AND r.category='CALL_CENTER_REQUEST' AND ${callCenterTaskFilter(branch, q.followUp, now, tehranDay(now))})`,
      );
    return Prisma.join(terms, ' AND ');
  }
  private async revision(
    tx: Prisma.TransactionClient,
    branch: string,
    q: CallCenterSearchDto,
    teamUsers?: string[],
  ) {
    const calls = await tx.callCenterCall.aggregate({
      where: { contact: { branchId: branch } },
      _count: true,
      _max: { createdAt: true },
    });
    const requests = await tx.customerAffairsTicket.aggregate({
      where: { branchId: branch, category: 'CALL_CENTER_REQUEST' },
      _count: true,
      _max: { updatedAt: true },
      _sum: { version: true },
    });
    const tasks = await callCenterTaskRevision(tx, branch);
    const filters = Object.fromEntries(
      Object.entries(q).filter(([key]) => key !== 'page' && key !== 'revision'),
    );
    return this.crypto.fingerprint(
      JSON.stringify({
        branch,
        filters,
        calls,
        requests,
        tasks,
        teamUsers: teamUsers?.slice().sort(),
        day:
          q.followUp === 'TODAY' ? tehranDay(new Date()).toISOString() : null,
      }),
    );
  }
  async branches(actor: AuthenticatedActor) {
    this.workflow.scope(actor, undefined);
    return { data: await this.directory.callCenterBranches(actor) };
  }
  async teams(actor: AuthenticatedActor, branch: string | undefined) {
    return this.directory.options(actor, this.workflow.scope(actor, branch));
  }
  async search(
    actor: AuthenticatedActor,
    branch: string | undefined,
    q: CallCenterSearchDto,
  ) {
    const branchId = this.workflow.scope(actor, branch);
    const teamUsers = q.teamId
      ? ((await this.directory.options(actor, branchId)).units
          .find((t) => t.id === q.teamId)
          ?.users.map((u) => u.id) ?? [])
      : undefined;
    return this.db.client.$transaction(
      async (tx) => {
        const coverage = await tx.callCenterCall.count({
          where: { contact: { branchId }, searchVersion: 0 },
        });
        if (coverage)
          throw new ConflictException(
            'شاخص جست‌وجو در حال آماده‌سازی است؛ دوباره تلاش کنید.',
          );
        const revision = await this.revision(tx, branchId, q, teamUsers);
        if (q.page > 1 && q.revision !== revision)
          throw new ConflictException(
            'داده‌ها تغییر کرده‌اند؛ فهرست را تازه‌سازی کنید.',
          );
        const latest = Prisma.sql`SELECT x.id FROM customer_affairs_calls x WHERE x.contact_id=c.id ORDER BY x.occurred_at DESC,x.id ASC LIMIT 1`;
        const predicate = this.conditions(branchId, q, teamUsers);
        const matching =
          q.scope === 'ANY'
            ? Prisma.sql`EXISTS(SELECT 1 FROM customer_affairs_calls a WHERE a.contact_id=c.id AND ${predicate})`
            : Prisma.sql`EXISTS(SELECT 1 FROM customer_affairs_calls a WHERE a.id=(${latest}) AND ${predicate})`;
        const count = await tx.$queryRaw<
          Array<{ total: bigint }>
        >`SELECT count(*) AS total FROM customer_affairs_call_contacts c WHERE c.branch_id=${branchId}::uuid AND ${matching}`;
        const rows = await tx.$queryRaw<
          Array<{ id: string; latestId: string; callCount: bigint }>
        >`
        SELECT c.id,(${latest}) AS "latestId",(SELECT count(*) FROM customer_affairs_calls z WHERE z.contact_id=c.id) AS "callCount"
        FROM customer_affairs_call_contacts c WHERE c.branch_id=${branchId}::uuid AND ${matching}
        ORDER BY c.latest_occurred_at DESC,c.id ASC LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`;
        const calls = await tx.callCenterCall.findMany({
          where: { id: { in: rows.map((r) => r.latestId) } },
        });
        return {
          data: rows.map((row) => ({
            id: row.id,
            callCount: Number(row.callCount),
            latest: this.calls.presentSummary(
              calls.find((c) => c.id === row.latestId)!,
            ),
          })),
          meta: {
            branchId,
            total: Number(count[0]!.total),
            page: q.page,
            pageSize: q.pageSize,
            revision,
            scope: q.scope,
            asOf: new Date().toISOString(),
          },
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 15000,
      },
    );
  }
  async history(
    actor: AuthenticatedActor,
    branch: string | undefined,
    id: string,
    kind: 'calls' | 'notes',
    q: CallCenterHistoryDto,
  ) {
    const branchId = this.workflow.scope(actor, branch);
    const contact = await this.db.client.callCenterContact.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!contact) throw new NotFoundException();
    if (kind === 'calls') {
      const anchor = q.after
        ? await this.db.client.callCenterCall.findFirst({
            where: { id: q.after, contactId: id },
          })
        : null;
      if (q.after && !anchor)
        throw new BadRequestException('نشانگر تاریخچه معتبر نیست.');
      const rows = await this.db.client.callCenterCall.findMany({
        where: {
          contactId: id,
          ...(anchor
            ? {
                OR: [
                  { occurredAt: { lt: anchor.occurredAt } },
                  { occurredAt: anchor.occurredAt, id: { gt: anchor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ occurredAt: 'desc' }, { id: 'asc' }],
        take: q.pageSize + 1,
      });
      return {
        data: rows.slice(0, q.pageSize).map((r) => this.calls.presentCall(r)),
        meta: {
          next: rows.length > q.pageSize ? rows[q.pageSize - 1]!.id : null,
        },
      };
    }
    const anchor = q.after
      ? await this.db.client.callCenterNote.findFirst({
          where: { id: q.after, contactId: id },
        })
      : null;
    if (q.after && !anchor)
      throw new BadRequestException('نشانگر تاریخچه معتبر نیست.');
    const rows = await this.db.client.callCenterNote.findMany({
      where: {
        contactId: id,
        ...(anchor
          ? {
              OR: [
                { createdAt: { lt: anchor.createdAt } },
                { createdAt: anchor.createdAt, id: { gt: anchor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: q.pageSize + 1,
    });
    return {
      data: rows.slice(0, q.pageSize).map((r) => this.calls.presentNote(r)),
      meta: {
        next: rows.length > q.pageSize ? rows[q.pageSize - 1]!.id : null,
      },
    };
  }
  async report(
    actor: AuthenticatedActor,
    branch: string | undefined,
    q: CallCenterSearchDto,
  ) {
    const branchId = this.workflow.scope(actor, branch),
      now = new Date();
    const teamUsers = q.teamId
      ? ((await this.directory.options(actor, branchId)).units
          .find((t) => t.id === q.teamId)
          ?.users.map((u) => u.id) ?? [])
      : undefined;
    const from = q.from
        ? new Date(q.from)
        : new Date(tehranDay(now).getTime() - 29 * 86400000),
      to = q.to ? new Date(q.to) : now;
    if (!(to > from) || to.getTime() - from.getTime() > 366 * 86400000)
      throw new BadRequestException('بازه گزارش باید حداکثر ۳۶۶ روز باشد.');
    return this.db.client.$transaction(
      async (tx) => {
        if (
          await tx.callCenterCall.count({
            where: { contact: { branchId }, searchVersion: 0 },
          })
        ) {
          throw new ConflictException(
            'شاخص جست‌وجو در حال آماده‌سازی است؛ دوباره تلاش کنید.',
          );
        }
        const predicate = this.conditions(
          branchId,
          { ...q, from: from.toISOString(), to: to.toISOString() },
          teamUsers,
        );
        const groups = await tx.$queryRaw<
          Array<{
            direction: string;
            outcome: string | null;
            origin: string | null;
            count: bigint;
          }>
        >`
        SELECT a.direction,a.outcome,a.origin,count(*) AS count FROM customer_affairs_calls a JOIN customer_affairs_call_contacts c ON c.id=a.contact_id WHERE ${predicate} GROUP BY a.direction,a.outcome,a.origin`;
        const totals = await tx.$queryRaw<
          Array<{ contacts: bigint; incomplete: bigint; unindexed: bigint }>
        >`SELECT count(DISTINCT a.contact_id) AS contacts,count(*) FILTER(WHERE a.needs_completion) AS incomplete,count(*) FILTER(WHERE a.search_version=0) AS unindexed FROM customer_affairs_calls a JOIN customer_affairs_call_contacts c ON c.id=a.contact_id WHERE ${predicate}`;
        const sources = await tx.$queryRaw<
          Array<{ token: string | null; count: bigint }>
        >`SELECT a.source_token AS token,count(*) AS count FROM customer_affairs_calls a JOIN customer_affairs_call_contacts c ON c.id=a.contact_id WHERE ${predicate} GROUP BY a.source_token`;
        const registrations = await tx.$queryRaw<
          Array<{ actorId: string; count: bigint }>
        >`SELECT a.created_by_user_id AS "actorId",count(*) AS count FROM customer_affairs_calls a JOIN customer_affairs_call_contacts c ON c.id=a.contact_id WHERE ${predicate} GROUP BY a.created_by_user_id`;
        const requests = await tx.customerAffairsTicket.groupBy({
          by: ['status'],
          where: {
            branchId,
            category: 'CALL_CENTER_REQUEST',
            createdAt: { gte: from, lt: to },
          },
          _count: true,
        });
        const tasks = await callCenterTaskReport(
          tx,
          branchId,
          from,
          to,
          now,
          tehranDay(now),
        );
        const labels = [
          'نامشخص',
          'اینستاگرام',
          'گوگل',
          'سایت',
          'تلگرام',
          'معرفی دوستان',
        ];
        return {
          data: {
            calls: groups.reduce((n, g) => n + Number(g.count), 0),
            contacts: Number(totals[0]!.contacts),
            incomplete: Number(totals[0]!.incomplete),
            unindexed: Number(totals[0]!.unindexed),
            groups: groups.map((g) => ({ ...g, count: Number(g.count) })),
            sources: sources.map((s) => ({
              label:
                labels.find(
                  (l) =>
                    callSearchToken(this.crypto, branchId, 'source', l) ===
                    s.token,
                ) ?? 'سایر / نامشخص',
              count: Number(s.count),
            })),
            registrations: registrations.map((r) => ({
              ...r,
              count: Number(r.count),
            })),
            requests: requests.map((r) => ({
              status: r.status,
              count: r._count,
            })),
            tasks: {
              ...tasks,
              onTimeRate: tasks.completed
                ? tasks.onTime / tasks.completed
                : null,
            },
          },
          meta: {
            branchId,
            from: from.toISOString(),
            to: to.toISOString(),
            asOf: now.toISOString(),
            timezone: 'Asia/Tehran',
            callBasis: 'occurredAt',
            requestBasis: 'createdAt; current status',
            taskBasis:
              'open=current branch backlog; completed=completedAt; denominator=completed only',
            filterScope:
              'call filters apply to calls/contacts/sources/registrations only; request and task sections explicitly branch-wide',
            contactDefinition:
              'unique branch phone-group; withheld calls separate; not unique people',
          },
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 15000,
      },
    );
  }
}
