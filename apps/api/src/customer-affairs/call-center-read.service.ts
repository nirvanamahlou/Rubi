import { todayCallUnitPage } from './today-call-unit-page';
import { callPerformanceStaff } from '../hr/hr-call-performance-directory';
import { callCenterExpertTasks } from '../tasks/call-center-read';
import {
  expertPerformance,
  type ExpertCallFact,
  type ExpertMetric,
} from './expert-performance';
import type { TelephonyTechnical } from './telephony-state';
import { IamCallCenterDirectory } from '../iam/iam-call-center-directory';
import { matchesContactColumns } from './contact-column-filters';
import {
  missedCallbackCount,
  missedCallbackContacts,
} from './call-center-callbacks';
import { IamWorkbenchRequestDirectory } from '../iam/iam-workbench-request-directory';
import { answeredCallAccess } from '../iam/call-center-answer-policy';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
export function tehranWeek(now: Date) {
  const day = tehranDay(now);
  const weekday = new Date(day.getTime() + 210 * 60000).getUTCDay();
  return new Date(day.getTime() - ((weekday + 1) % 7) * 86400000);
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
    @Inject(IamCallCenterDirectory)
    private readonly recordingAccounts: IamCallCenterDirectory = new IamCallCenterDirectory(
      db,
    ),
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
          ? Prisma.sql`(
              ((a.origin IS NULL OR a.origin <> 'TELEPHONY')
                AND a.created_by_user_id IN (${Prisma.join(teamUsers.map((id) => Prisma.sql`${id}::uuid`))}))
              OR (a.origin='TELEPHONY' AND (
                EXISTS(SELECT 1 FROM call_center_answer_responsibilities ar
                  WHERE ar."callId"=a.id AND ar."userId" IN (${Prisma.join(teamUsers.map((id) => Prisma.sql`${id}::uuid`))}))
                OR EXISTS(SELECT 1 FROM call_center_telephony_sessions s
                  JOIN call_center_telephony_offers o ON o."sessionId"=s.id
                  WHERE s."callId"=a.id AND s.synthetic=false AND o."mappingVersion">0
                    AND o."userId" IN (${Prisma.join(teamUsers.map((id) => Prisma.sql`${id}::uuid`))})
                    AND (a.direction='OUTBOUND' OR NOT EXISTS(
                      SELECT 1 FROM call_center_answer_responsibilities answered WHERE answered."callId"=a.id
                    )))
              ))
            )`
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
        Prisma.sql`EXISTS(SELECT 1 FROM customer_affairs_tickets r WHERE r.call_center_contact_id=c.id AND r.branch_id=c.branch_id AND ${q.requestStatus === 'IN_PROGRESS' || q.requestStatus === 'NEW' ? Prisma.sql`r.status IN ('NEW', 'IN_PROGRESS')` : Prisma.sql`r.status=${q.requestStatus}`} AND r.category='CALL_CENTER_REQUEST')`,
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
    const telephony = await tx.callCenterTelephonySession.aggregate({
      where: { call: { contact: { branchId: branch } } },
      _sum: { version: true },
    });
    const completions = await tx.customerAffairsAuditEvent.aggregate({
      where: {
        branchId: branch,
        action: { in: ['COMPLETE_CALL', 'SAVE', 'RECONCILE_CALL_COMPLETION'] },
      },
      _count: true,
      _max: { occurredAt: true },
    });
    const filters = Object.fromEntries(
      Object.entries(q).filter(([key]) => key !== 'page' && key !== 'revision'),
    );
    return this.crypto.fingerprint(
      JSON.stringify({
        branch,
        filters,
        calls,
        completions,
        telephony,
        requests,
        tasks,
        teamUsers: teamUsers?.slice().sort(),
        day:
          q.followUp === 'TODAY' ? tehranDay(new Date()).toISOString() : null,
      }),
    );
  }
  async recordingAccess(actor: AuthenticatedActor) {
    this.workflow.scope(actor, undefined);
    return {
      data: {
        allowed: await this.recordingAccounts.canDownloadCallRecordings(actor),
      },
    };
  }
  async branches(actor: AuthenticatedActor) {
    this.workflow.scope(actor, undefined);
    const data = await this.directory.callCenterBranches(actor);
    const employeeBranches =
      await this.directory.callCenterEmployeeBranches(actor);
    const ownBranches = data.filter((branch) =>
      employeeBranches.includes(branch.id),
    );
    const candidates = ownBranches.length ? ownBranches : data;
    let defaultBranchId: string | null = candidates[0]?.id ?? null;
    if (candidates.length > 1) {
      const recent = await Promise.all(
        candidates.map(async (branch) => {
          try {
            const scope = await this.calls.access.where(actor, branch.id);
            const call = await this.db.client.callCenterCall.findFirst({
              where: { contact: scope },
              orderBy: [{ occurredAt: 'desc' }, { id: 'asc' }],
              select: { occurredAt: true },
            });
            return {
              id: branch.id,
              at: call?.occurredAt.getTime() ?? -Infinity,
            };
          } catch (error) {
            if (!(error instanceof ForbiddenException)) throw error;
            return { id: branch.id, at: -Infinity };
          }
        }),
      );
      recent.sort((a, b) => b.at - a.at);
      defaultBranchId = recent[0]?.id ?? defaultBranchId;
    }
    return { data, meta: { defaultBranchId } };
  }
  async teams(actor: AuthenticatedActor, branch: string | undefined) {
    const branchId = this.workflow.scope(actor, branch);
    const options = await this.directory.options(
      actor,
      branchId,
      undefined,
      true,
    );
    if (!this.workflow.access.scoped(actor)) return options;
    const users = await this.workflow.access.users(actor, branchId, 'contacts');
    if (users === null) return options;
    return {
      units: options.units
        .map((unit) => ({
          ...unit,
          users: unit.users.filter((user) => users.includes(user.id)),
        }))
        .filter((unit) => unit.users.length > 0),
    };
  }
  async search(
    actor: AuthenticatedActor,
    branch: string | undefined,
    q: CallCenterSearchDto,
  ) {
    const branchId = this.workflow.scope(actor, branch);
    const teamUsers = q.teamId
      ? ((await this.teams(actor, branchId)).units
          .find((t) => t.id === q.teamId)
          ?.users.map((u) => u.id) ?? [])
      : undefined;
    return this.db.client.$transaction(
      async (tx) => {
        const scope = await this.workflow.access.sql(
          actor,
          branchId,
          'contacts',
          tx,
          true,
        );
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
        const latest = Prisma.sql`SELECT a.id FROM customer_affairs_calls a WHERE a.contact_id=c.id AND (${scope}) ORDER BY a.occurred_at DESC,a.id ASC LIMIT 1`;
        const columnFilters = !!(
          q.direction ||
          q.outcome ||
          q.source ||
          q.unit ||
          q.incomplete
        );
        const sqlFilters = { ...q };
        if (columnFilters) {
          delete sqlFilters.direction;
          delete sqlFilters.outcome;
          delete sqlFilters.source;
          delete sqlFilters.unit;
          delete sqlFilters.incomplete;
        }
        const predicate = Prisma.sql`(${this.conditions(branchId, sqlFilters, teamUsers)}) AND (${scope})`;
        const matchingCall =
          q.scope === 'ANY'
            ? Prisma.sql`EXISTS(SELECT 1 FROM customer_affairs_calls a WHERE a.contact_id=c.id AND ${predicate})`
            : Prisma.sql`EXISTS(SELECT 1 FROM customer_affairs_calls a WHERE a.id=(${latest}) AND ${predicate})`;
        // The unit selector describes the displayed latest authorized call,
        // even when the text search includes older calls on the same number.
        const matching = teamUsers
          ? Prisma.sql`(${matchingCall}) AND EXISTS(SELECT 1 FROM customer_affairs_calls a WHERE a.id=(${latest}) AND ${this.conditions(branchId, {} as CallCenterSearchDto, teamUsers)})`
          : matchingCall;
        if (columnFilters) {
          type Row = { id: string; latestId: string; callCount: bigint };
          const selected: {
            id: string;
            callCount: number;
            latest: ReturnType<CallCenterService['presentSummary']>;
          }[] = [];
          let total = 0;
          for (let offset = 0; ; offset += 200) {
            const rows = await tx.$queryRaw<Row[]>`
              SELECT c.id,(${latest}) AS "latestId",(SELECT count(*) FROM customer_affairs_calls a WHERE a.contact_id=c.id AND (${scope})) AS "callCount"
              FROM customer_affairs_call_contacts c WHERE c.branch_id=${branchId}::uuid AND ${matching}
              ORDER BY (SELECT a.occurred_at FROM customer_affairs_calls a WHERE a.id=(${latest})) DESC,c.id ASC LIMIT 200 OFFSET ${offset}`;
            const calls = await tx.callCenterCall.findMany({
              where: { id: { in: rows.map((row) => row.latestId) } },
            });
            const summaries = await this.calls.hydrateDestinations(
              branchId,
              calls.map((call) => this.calls.presentSummary(call)),
              tx,
            );
            const indexed = new Map(summaries.map((call) => [call.id, call]));
            for (const row of rows) {
              const call = indexed.get(row.latestId);
              if (!call || !matchesContactColumns(call, q)) continue;
              if (
                total >= (q.page - 1) * q.pageSize &&
                selected.length < q.pageSize
              )
                selected.push({
                  id: row.id,
                  callCount: Number(row.callCount),
                  latest: call,
                });
              total++;
            }
            if (rows.length < 200) break;
          }
          return {
            data: selected,
            meta: {
              branchId,
              total,
              page: q.page,
              pageSize: q.pageSize,
              revision,
              scope: q.scope,
              asOf: new Date().toISOString(),
            },
          };
        }
        const count = await tx.$queryRaw<
          Array<{ total: bigint }>
        >`SELECT count(*) AS total FROM customer_affairs_call_contacts c WHERE c.branch_id=${branchId}::uuid AND ${matching}`;
        const rows = await tx.$queryRaw<
          Array<{ id: string; latestId: string; callCount: bigint }>
        >`
        SELECT c.id,(${latest}) AS "latestId",(SELECT count(*) FROM customer_affairs_calls a WHERE a.contact_id=c.id AND (${scope})) AS "callCount"
        FROM customer_affairs_call_contacts c WHERE c.branch_id=${branchId}::uuid AND ${matching}
        ORDER BY (SELECT a.occurred_at FROM customer_affairs_calls a WHERE a.id=(${latest})) DESC,c.id ASC LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`;
        const calls = await tx.callCenterCall.findMany({
          where: { id: { in: rows.map((r) => r.latestId) } },
        });
        const summaries = await this.calls.hydrateDestinations(
          branchId,
          calls.map((call) => this.calls.presentSummary(call)),
          tx,
        );
        return {
          data: rows.map((row) => ({
            id: row.id,
            callCount: Number(row.callCount),
            latest: summaries.find((call) => call.id === row.latestId)!,
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
    if (this.workflow.access.scoped(actor))
      await this.workflow.access.contact(actor, branchId, id);
    const contact = await this.db.client.callCenterContact.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!contact) throw new NotFoundException();
    if (kind === 'calls') {
      const callScope = await this.workflow.access.callWhere(actor, branchId);
      const anchor = q.after
        ? await this.db.client.callCenterCall.findFirst({
            where: { AND: [callScope, { id: q.after, contactId: id }] },
          })
        : null;
      if (q.after && !anchor)
        throw new BadRequestException('نشانگر تاریخچه معتبر نیست.');
      const rows = await this.db.client.callCenterCall.findMany({
        where: {
          AND: [callScope],
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
        data: await this.calls.hydrateDestinations(
          branchId,
          rows.slice(0, q.pageSize).map((r) => this.calls.presentCall(r)),
        ),
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
  async kpis(actor: AuthenticatedActor, branch: string | undefined) {
    const branchId = this.workflow.scope(actor, branch);
    const scope = await this.workflow.access.sql(
      actor,
      branchId,
      'reports',
      undefined,
      true,
    );
    const contactScope = await this.identityScope(actor, branchId);
    const now = new Date(),
      day = tehranDay(now),
      week = tehranWeek(now);
    const rows = await this.db.client.$queryRaw<
      Array<{
        today: bigint;
        week: bigint;
        withoutOutcome: bigint;
      }>
    >`SELECT
      count(*) FILTER(WHERE a.occurred_at >= ${day} AND a.occurred_at <= ${now} AND (${contactScope})) AS today,
      count(*) FILTER(WHERE a.occurred_at >= ${week} AND a.occurred_at <= ${now} AND (${contactScope})) AS week,
      count(*) FILTER(WHERE a.outcome IS NULL AND (${contactScope})) AS "withoutOutcome"
      FROM customer_affairs_calls a
      JOIN customer_affairs_call_contacts c ON c.id=a.contact_id
      WHERE c.branch_id=${branchId}::uuid AND a.occurred_at <= ${now}
        AND (${scope}) AND (a.origin IS NULL OR a.origin <> 'SYNTHETIC')`;
    const row = rows[0]!;
    return {
      data: {
        today: Number(row.today),
        week: Number(row.week),
        withoutOutcome: Number(row.withoutOutcome),
        needsFollowUp: await this.db.client.$transaction(
          (tx) =>
            missedCallbackCount(
              tx,
              this.crypto,
              branchId,
              scope,
              contactScope,
              now,
            ),
          {
            isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
            timeout: 60000,
          },
        ),
      },
      meta: {
        branchId,
        asOf: now.toISOString(),
        timezone: 'Asia/Tehran',
        todayFrom: day.toISOString(),
        weekFrom: week.toISOString(),
        scope:
          'selected branch; independent of list filters; excludes synthetic calls',
        basis:
          'today/week=occurredAt through asOf; withoutOutcome=all history with null outcome; needsFollowUp=unique known callers with missed inbound calls and no later answered inbound/outbound conversation; provider technical facts precede manual outcomes; all history',
      },
    };
  }
  private async identityScope(
    actor: AuthenticatedActor,
    branchId: string,
    tx?: Prisma.TransactionClient,
  ) {
    try {
      return await this.workflow.access.sql(
        actor,
        branchId,
        'contacts',
        tx,
        true,
      );
    } catch (error) {
      if (!(error instanceof ForbiddenException)) throw error;
      return Prisma.sql`FALSE`;
    }
  }
  async withoutOutcome(
    actor: AuthenticatedActor,
    branch: string | undefined,
    input: CallCenterSearchDto,
    period?: 'today' | 'week',
  ) {
    const branchId = this.workflow.scope(actor, branch);
    // Only Today accepts its three local controls; outer contact filters never affect KPI drilldowns.
    const q = {
      page: input.page,
      pageSize: input.pageSize,
      revision: input.revision,
      outcome:
        period === 'today' ? input.outcome : period ? undefined : 'UNKNOWN',
      ...(period === 'today'
        ? { direction: input.direction, unit: input.unit }
        : {}),
    } as CallCenterSearchDto;
    return this.db.client.$transaction(
      async (tx) => {
        const reportScope = await this.workflow.access.sql(
          actor,
          branchId,
          'reports',
          tx,
          true,
        );
        const contactScope = await this.identityScope(actor, branchId, tx);
        const now = new Date();
        const from =
          period === 'today'
            ? tehranDay(now)
            : period === 'week'
              ? tehranWeek(now)
              : null;
        const revision = this.crypto.fingerprint(
          JSON.stringify({
            period: period ?? 'without-outcome',
            from,
            data: await this.revision(tx, branchId, q),
          }),
        );
        if (q.page > 1 && q.revision !== revision)
          throw new ConflictException(
            'داده‌ها تغییر کرده‌اند؛ فهرست را تازه‌سازی کنید.',
          );
        const indexedFilters = { ...q };
        delete indexedFilters.unit;
        const predicate = Prisma.sql`(${this.conditions(branchId, indexedFilters)}) AND ${period ? Prisma.sql`a.occurred_at >= ${from}` : Prisma.sql`a.outcome IS NULL`}
        AND a.occurred_at <= ${now} AND (a.origin IS NULL OR a.origin <> 'SYNTHETIC')
        AND (${reportScope}) AND (${contactScope})`;
        const meta = (total: number) => ({
          total,
          page: q.page,
          pageSize: q.pageSize,
          revision,
          asOf: now.toISOString(),
        });
        if (period === 'today' && q.unit) {
          const selected = await todayCallUnitPage(
            tx,
            predicate,
            { page: q.page, pageSize: q.pageSize, unit: q.unit },
            (rows) =>
              this.calls.hydrateDestinations(
                branchId,
                rows.map((row) => this.calls.presentSummary(row)),
                tx,
              ),
          );
          return { data: selected.data, meta: meta(selected.total) };
        }
        const count = await tx.$queryRaw<
          Array<{ total: bigint }>
        >`SELECT count(*) AS total
        FROM customer_affairs_calls a JOIN customer_affairs_call_contacts c ON c.id=a.contact_id WHERE ${predicate}`;
        const ids = await tx.$queryRaw<
          Array<{ id: string; callCount: bigint }>
        >`SELECT a.id,
        (SELECT count(*) FROM customer_affairs_calls a WHERE a.contact_id=c.id AND (${reportScope}) AND (${contactScope})) AS "callCount"
        FROM customer_affairs_calls a JOIN customer_affairs_call_contacts c ON c.id=a.contact_id WHERE ${predicate}
        ORDER BY a.occurred_at DESC,a.id ASC LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`;
        const rows = await tx.callCenterCall.findMany({
          where: { id: { in: ids.map((r) => r.id) } },
        });
        const summaries = rows.map((row) => this.calls.presentSummary(row));
        const presented = new Map(
          (period === 'today'
            ? await this.calls.hydrateDestinations(branchId, summaries, tx)
            : summaries
          ).map((call) => [call.id, call]),
        );
        return {
          data: ids.map((r) => ({
            call: presented.get(r.id)!,
            callCount: Number(r.callCount),
          })),
          meta: meta(Number(count[0]!.total)),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 15000,
      },
    );
  }
  async missedCallbacks(
    actor: AuthenticatedActor,
    branch: string | undefined,
    input: CallCenterSearchDto,
  ) {
    const branchId = this.workflow.scope(actor, branch);
    return this.db.client.$transaction(
      async (tx) => {
        const now = new Date();
        const reportScope = await this.workflow.access.sql(
          actor,
          branchId,
          'reports',
          tx,
          true,
        );
        const contactScope = await this.identityScope(actor, branchId, tx);
        const pending = await missedCallbackContacts(
          tx,
          this.crypto,
          branchId,
          reportScope,
          contactScope,
          now,
        );
        // Membership hash also invalidates paging after ownership/permission changes.
        const revision = this.crypto.fingerprint(
          JSON.stringify({
            kind: 'missed-callbacks-v1',
            pending,
            pageSize: input.pageSize,
            data: await this.revision(tx, branchId, {
              page: 1,
              pageSize: input.pageSize,
            } as CallCenterSearchDto),
          }),
        );
        if (input.page > 1 && input.revision !== revision)
          throw new ConflictException(
            'داده‌ها تغییر کرده‌اند؛ فهرست را تازه‌سازی کنید.',
          );
        const page = pending.slice(
          (input.page - 1) * input.pageSize,
          input.page * input.pageSize,
        );
        const calls = await tx.callCenterCall.findMany({
          where: { id: { in: page.map((p) => p.callId) } },
        });
        const counts = await tx.callCenterCall.groupBy({
          by: ['contactId'],
          where: {
            AND: [await this.workflow.access.callWhere(actor, branchId, tx)],
            contactId: { in: page.map((p) => p.contactId) },
            occurredAt: { lte: now },
            OR: [{ origin: null }, { origin: { not: 'SYNTHETIC' } }],
          },
          _count: true,
        });
        return {
          data: page.map((p) => ({
            call: this.calls.presentSummary(
              calls.find((c) => c.id === p.callId)!,
            ),
            callCount:
              counts.find((c) => c.contactId === p.contactId)?._count ?? 0,
          })),
          meta: {
            // Use the effective actor from CallCenterActorGuard, not browser auth.
            // Request writes still enforce their own server authorization.
            canCreateRequest:
              actor.permissions.includes(
                'customer_affairs.call_center.workflow.manage',
              ) &&
              actor.permissions.includes(
                'customer_affairs.call_center.workflow.manage.team',
              ),
            total: pending.length,
            page: input.page,
            pageSize: input.pageSize,
            revision,
            asOf: now.toISOString(),
          },
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 60000,
      },
    );
  }
  async report(
    actor: AuthenticatedActor,
    branch: string | undefined,
    q: CallCenterSearchDto,
  ) {
    const branchId = this.workflow.scope(actor, branch),
      now = new Date();
    const teamUsers = q.teamId
      ? ((await this.teams(actor, branchId)).units
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
        const scope = await this.workflow.access.sql(
          actor,
          branchId,
          'reports',
          tx,
          true,
        );
        let contactIdentityScope = Prisma.sql`TRUE`;
        if (this.workflow.access.scoped(actor)) {
          try {
            contactIdentityScope = await this.workflow.access.sql(
              actor,
              branchId,
              'contacts',
              tx,
              true,
            );
          } catch (error) {
            if (!(error instanceof ForbiddenException)) throw error;
            contactIdentityScope = Prisma.sql`FALSE`;
          }
        }
        const users = await this.workflow.access.users(
          actor,
          branchId,
          'reports',
          tx,
        );
        if (
          await tx.callCenterCall.count({
            where: { contact: { branchId }, searchVersion: 0 },
          })
        ) {
          throw new ConflictException(
            'شاخص جست‌وجو در حال آماده‌سازی است؛ دوباره تلاش کنید.',
          );
        }
        const callPredicate = this.conditions(
          branchId,
          { ...q, from: from.toISOString(), to: to.toISOString() },
          teamUsers,
        );
        const predicate = Prisma.sql`(${callPredicate}) AND (${scope}) AND (a.origin IS NULL OR a.origin <> 'SYNTHETIC')`;
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
        >`SELECT chosen.token,count(*) AS count FROM (
SELECT DISTINCT ON (a.contact_id) a.contact_id,a.source_token AS token
FROM customer_affairs_calls a JOIN customer_affairs_call_contacts c ON c.id=a.contact_id
WHERE ${predicate}
ORDER BY a.contact_id,a.occurred_at DESC,a.id ASC
) chosen GROUP BY chosen.token`;
        const registrations = await tx.$queryRaw<
          Array<{ actorId: string; count: bigint }>
        >`SELECT a.created_by_user_id AS "actorId",count(*) AS count FROM customer_affairs_calls a JOIN customer_affairs_call_contacts c ON c.id=a.contact_id WHERE ${predicate} AND (a.origin IS NULL OR a.origin = 'MANUAL') GROUP BY a.created_by_user_id`;
        const followed = await tx.$queryRaw<
          Array<{ contactId: string; latestId: string; count: bigint }>
        >`WITH ranked AS (SELECT a.contact_id, count(*) AS count
          FROM customer_affairs_calls a JOIN customer_affairs_call_contacts c ON c.id=a.contact_id
          WHERE ${predicate} AND (${contactIdentityScope}) AND a.direction='OUTBOUND'
          GROUP BY a.contact_id ORDER BY count(*) DESC,a.contact_id ASC LIMIT 5)
          SELECT ranked.contact_id AS "contactId", detail.id AS "latestId", ranked.count
          FROM ranked JOIN customer_affairs_call_contacts c ON c.id=ranked.contact_id
          CROSS JOIN LATERAL (SELECT a.id FROM customer_affairs_calls a
            WHERE a.contact_id=ranked.contact_id AND ${predicate} AND a.direction='OUTBOUND'
            ORDER BY a.occurred_at DESC,a.id ASC LIMIT 1) detail
          ORDER BY ranked.count DESC,ranked.contact_id ASC`;
        const followedCalls = await tx.callCenterCall.findMany({
          where: {
            id: { in: followed.map((r) => r.latestId) },
            contact: { branchId },
          },
        });
        const requests = await tx.customerAffairsTicket.groupBy({
          by: ['status'],
          where: {
            branchId,
            category: 'CALL_CENTER_REQUEST',
            createdAt: { gte: from, lt: to },
            ...(users ? { executionOwnerUserId: { in: users } } : {}),
            ...(answeredCallAccess()
              ? {
                  callCenterContact: await this.workflow.access.where(
                    actor,
                    branchId,
                    'reports',
                    tx,
                  ),
                }
              : {}),
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
          users,
        );
        const expertIds = await tx.$queryRaw<
          { id: string }[]
        >`SELECT a.id FROM customer_affairs_calls a JOIN customer_affairs_call_contacts c ON c.id=a.contact_id WHERE ${predicate} AND a.origin='TELEPHONY' ORDER BY a.occurred_at,a.id LIMIT 10001`;
        if (expertIds.length > 10000)
          throw new BadRequestException(
            'برای گزارش کارشناسان بازه کوتاه‌تری انتخاب کنید؛ حداکثر ۱۰۰۰۰ تماس.',
          );
        const expertCalls = await tx.callCenterCall.findMany({
          where: { id: { in: expertIds.map((r) => r.id) } },
          include: { answerResponsibilities: { select: { userId: true } } },
          orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
        });
        const sessions = await tx.callCenterTelephonySession.findMany({
          where: {
            callId: { in: expertIds.map((r) => r.id) },
            synthetic: false,
          },
          include: { offers: { select: { userId: true } } },
        });
        const sessionByCall = new Map(sessions.map((s) => [s.callId, s]));
        const facts: ExpertCallFact[] = expertCalls.map((call) => {
          const session = sessionByCall.get(call.id);
          const technical = session
            ? this.crypto.decrypt<TelephonyTechnical>(
                session.encryptedTechnical,
                session.keyVersion,
                `telephony:${session.id}`,
              )
            : null;
          const valid =
            technical &&
            (technical.first.direction === 'OUT' ? 'OUTBOUND' : 'INBOUND') ===
              call.direction;
          const connected =
            call.answerResponsibilities.length > 0 ||
            !!(valid && technical.answered);
          const ids =
            call.direction === 'INBOUND'
              ? call.answerResponsibilities.map((a) => a.userId)
              : valid
                ? (session?.offers.map((o) => o.userId) ?? [])
                : [];
          const payload = this.calls.presentSummary(call);
          return {
            id: call.id,
            contactId: call.contactId,
            knownPhone: !!payload.phone,
            at: call.occurredAt.toISOString(),
            direction: call.direction,
            connected,
            complete: !call.needsCompletion && !!call.outcome,
            actors: [...new Set(ids)],
            extension:
              valid && call.direction === 'OUTBOUND'
                ? (technical.first.extension ?? undefined)
                : undefined,
          };
        });
        const expert = expertPerformance(
          await callPerformanceStaff(tx, branchId, users),
          facts,
          await callCenterExpertTasks(tx, branchId, users),
          now.toISOString(),
          users,
        );
        let activityDetail:
          | {
              actorId: string;
              metric: string;
              rows: unknown[];
              total: number;
              page: number;
              pageSize: number;
            }
          | undefined;
        if (q.activityActorId || q.activityMetric) {
          if (!q.activityActorId || !q.activityMetric)
            throw new BadRequestException('کارشناس و ستون را انتخاب کنید.');
          const detail = expert.details.get(q.activityActorId)?.[
            q.activityMetric as ExpertMetric
          ];
          if (!detail)
            throw new ForbiddenException('کارشناس در محدوده گزارش نیست.');
          const sorted = [...detail].sort((a, b) =>
            (a.at ?? '9999').localeCompare(b.at ?? '9999'),
          );
          activityDetail = {
            actorId: q.activityActorId,
            metric: q.activityMetric,
            rows: sorted.slice((q.page - 1) * q.pageSize, q.page * q.pageSize),
            total: sorted.length,
            page: q.page,
            pageSize: q.pageSize,
          };
        }
        const labels = [
          'نامشخص',
          'اینستاگرام',
          'گوگل',
          'سایت',
          'تلگرام',
          'معرفی دوستان',
          'SMS',
          'آژانس',
          'سایر',
        ];
        return {
          data: {
            expertActivity: {
              rows: expert.rows,
              unattributed: expert.unattributed,
            },
            ...(activityDetail ? { activityDetail } : {}),
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
            topFollowUps: followed.map((row) => ({
              contactId: row.contactId,
              name:
                this.calls.presentSummary(
                  followedCalls.find((c) => c.id === row.latestId)!,
                ).name || 'مخاطب ناشناس',
              count: Number(row.count),
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
            sourceBasis:
              'unique branch phone-group; latest matching call source within authorized report filters and time range; occurredAt DESC/id ASC',
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
