import { nextRadanSyncAt } from './hr-radan-sync-schedule';
import { attendanceFrom } from './hr-attendance-range';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { randomUUID } from 'node:crypto';
import { IamService } from '../iam/iam.service';
import { HrService } from './hr.service';
import {
  RadanDeviceClient,
  type RadanUser,
  type RadanPunch,
} from './hr-radan-device.client';
import {
  digits,
  isoDate,
  localClockParts,
  localClockToUtc,
} from './hr.validation';

type DeviceSource = {
  source?: string;
  personnelCodes?: string[] | undefined;
  branchId: string;
  base: string;
  username: string;
  password: string;
  dateOffsetDays: number;
  dateCorrectedFrom?: string | undefined;
};

@Injectable()
export class HrRadanDeviceService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = true;
  private nextSyncAt: string | null = null;
  private running = false;
  private readonly reconciledOn = new Map<string, string>();
  private readonly pending = new Map<string, Map<string, Set<string>>>();
  private readonly absencesOn = new Map<string, string>();
  private readonly lastSuccess = new Map<string, Record<string, unknown>>();
  private readonly userCache = new Map<
    string,
    { expires: number; users: RadanUser[] }
  >();
  private readonly logger = new Logger(HrRadanDeviceService.name);
  private latest: Record<string, unknown> = { state: 'idle' };
  constructor(
    @Inject(HrService) private readonly hr: HrService,
    @Inject(IamService) private readonly iam: IamService,
  ) {}
  onModuleInit() {
    if (process.env.HR_RADAN_ENABLED !== 'true') return;
    this.stopped = false;
    void this.tick().finally(() => this.schedule());
  }
  onModuleDestroy() {
    this.stopped = true;
    this.nextSyncAt = null;
    if (this.timer) clearTimeout(this.timer);
  }
  private schedule() {
    if (this.stopped) return;
    const now = new Date();
    const next = nextRadanSyncAt(now);
    this.nextSyncAt = next.toISOString();
    this.timer = setTimeout(() => {
      this.nextSyncAt = null;
      void this.tick().finally(() => this.schedule());
    }, next.getTime() - now.getTime());
    this.timer.unref();
  }
  private async tick() {
    if (this.running) return;
    try {
      const actor = await this.iam.authenticateAttendanceConnectorV1(
        process.env.HR_RADAN_ACTOR_ID ?? '',
      );
      await this.sync(actor, true);
    } catch {
      this.latest = {
        state: 'error',
        at: new Date().toISOString(),
        error: 'connector',
      };
      this.logger.warn(
        'Attendance synchronization failed; check provider, connector identity and branch scope.',
      );
    }
  }
  status(actor: AuthenticatedActor) {
    this.authorize(actor);
    let latest = this.latest;
    if (Array.isArray(latest.sources)) {
      const sources = (latest.sources as Record<string, unknown>[]).filter(
        (s) => actor.branchIds.includes(String(s.branchId)),
      );
      latest = {
        ...latest,
        sources,
        state:
          sources.length === 0
            ? 'idle'
            : sources.every((s) => s.state === 'ready')
              ? 'ready'
              : 'partial',
      };
    } else if (
      latest.branchId &&
      !actor.branchIds.includes(String(latest.branchId))
    ) {
      latest = { state: 'idle' };
    }
    return {
      ...latest,
      lastSuccessfulSources: [...this.lastSuccess.values()].filter((s) =>
        actor.branchIds.includes(String(s.branchId)),
      ),
      nextSyncAt: this.nextSyncAt,
      timeZone: 'Asia/Tehran',
    };
  }
  private authorize(actor: AuthenticatedActor) {
    const branchId = process.env.HR_RADAN_BRANCH_ID;
    if (!branchId)
      throw new ServiceUnavailableException(
        'Attendance connector is not configured',
      );
    if (
      !actor.permissions.includes('hr.manage') ||
      ![branchId, process.env.HR_RADAN_SECONDARY_BRANCH_ID].some(
        (id) => id && actor.branchIds.includes(id),
      )
    )
      throw new ForbiddenException('مجوز منابع انسانی وجود ندارد.');
    return branchId;
  }
  async sync(actor: AuthenticatedActor, scheduled = false, body?: unknown) {
    this.authorize(actor);
    let range: { from: string; to: string } | undefined;
    if (body && typeof body === 'object' && Object.keys(body).length) {
      const input = body as Record<string, unknown>;
      const from = isoDate(input.from).toISOString().slice(0, 10);
      const to = isoDate(input.to).toISOString().slice(0, 10);
      if (
        from > to ||
        to > localClockParts(new Date()).date ||
        attendanceFrom(from) !== from
      )
        throw new BadRequestException('بازه همگام‌سازی معتبر نیست.');
      range = { from, to };
    }
    if (this.running)
      throw new ConflictException(
        'Attendance synchronization is already running',
      );
    const base = process.env.HR_RADAN_BASE_URL,
      username = process.env.HR_RADAN_USERNAME,
      password = process.env.HR_RADAN_PASSWORD;
    if (!base || !username || !password)
      throw new ServiceUnavailableException(
        'Attendance connector is not configured',
      );
    const sources: DeviceSource[] = [
      {
        branchId: process.env.HR_RADAN_BRANCH_ID!,
        base,
        username,
        password,
        dateOffsetDays: 1,
        dateCorrectedFrom: process.env.HR_RADAN_DATE_CORRECTED_FROM,
      },
    ];
    const secondaryBranch = process.env.HR_RADAN_SECONDARY_BRANCH_ID;
    const secondaryBase = process.env.HR_RADAN_SECONDARY_BASE_URL;
    if (secondaryBranch || secondaryBase) {
      const offset = Number(
        process.env.HR_RADAN_SECONDARY_DATE_OFFSET_DAYS ?? '0',
      );
      if (
        !secondaryBranch ||
        !secondaryBase ||
        !Number.isInteger(offset) ||
        Math.abs(offset) > 1
      )
        throw new ServiceUnavailableException(
          'Invalid secondary attendance configuration',
        );
      sources.push({
        source: `radan:secondary:${secondaryBranch}`,
        personnelCodes: process.env.HR_RADAN_SECONDARY_PERSONNEL_CODES?.split(
          ',',
        )
          .map((code) => digits(code).trim())
          .filter(Boolean),
        branchId: secondaryBranch,
        base: secondaryBase,
        username: process.env.HR_RADAN_SECONDARY_USERNAME || username,
        password: process.env.HR_RADAN_SECONDARY_PASSWORD || password,
        dateOffsetDays: offset,
      });
    }
    this.running = true;
    try {
      const results: Record<string, unknown>[] = [];
      for (const source of sources.filter((s) =>
        actor.branchIds.includes(s.branchId),
      )) {
        try {
          results.push({
            ...(await this.syncSource(source, actor, scheduled, range)),
            branchId: source.branchId,
          });
        } catch (error) {
          results.push({
            state: 'error',
            error:
              error instanceof ServiceUnavailableException ||
              error instanceof TypeError
                ? 'provider'
                : 'processing',
            branchId: source.branchId,
            at: new Date().toISOString(),
          });
          this.logger.warn(
            'An attendance source failed; other sources continue independently.',
          );
        }
        if (scheduled) {
          try {
            await this.processAbsences(source, actor);
          } catch {
            this.logger.warn(
              'Attendance absence calculation failed; it will be retried.',
            );
          }
        }
      }
      this.latest =
        results.length === 1
          ? results[0]!
          : {
              state: results.every((r) => r.state === 'ready')
                ? 'ready'
                : 'partial',
              at: new Date().toISOString(),
              sources: results,
            };
      return this.latest;
    } finally {
      this.running = false;
    }
  }
  private async processAbsences(
    config: DeviceSource,
    actor: AuthenticatedActor,
  ) {
    const { date, time } = localClockParts(new Date());
    const source = config.source ?? `radan:${config.branchId}`;
    if (time < '04:00' || this.absencesOn.get(source) === date) return;
    const yesterday = new Date(isoDate(date).getTime() - 86400000)
      .toISOString()
      .slice(0, 10);
    if (yesterday < attendanceFrom(yesterday)) return;
    await this.hr.processAttendance(
      { branchId: config.branchId, date: yesterday },
      randomUUID(),
      actor,
      true,
      [],
      undefined,
      true,
    );
    this.absencesOn.set(source, date);
  }

  private async syncSource(
    config: DeviceSource,
    actor: AuthenticatedActor,
    scheduled: boolean,
    range?: { from: string; to: string },
  ) {
    const { base, username, password, branchId, dateOffsetDays } = config;
    if (config.dateCorrectedFrom) isoDate(config.dateCorrectedFrom);
    const provider = new RadanDeviceClient(base, username, password);
    await provider.login();
    const now = new Date();
    const today = localClockParts(now).date;
    const source = config.source ?? `radan:${branchId}`;
    const nightly =
      scheduled &&
      this.reconciledOn.get(source) !== today &&
      (localClockParts(now).time >= '02:00' || !this.reconciledOn.has(source));
    const shiftDay = (date: string, days: number) =>
      new Date(isoDate(date).getTime() + days * 86400000)
        .toISOString()
        .slice(0, 10);
    const from =
      range?.from ??
      attendanceFrom(shiftDay(today, nightly || !scheduled ? -30 : -1));
    const to = range?.to ?? today;
    const rawFrom = shiftDay(from, -Math.max(dateOffsetDays, 0));
    const clockings = await provider.list<RadanPunch>(
      '/V1/Ta/Clockings',
      'clockings',
      rawFrom,
    );
    let cached = this.userCache.get(source);
    const byId = new Map(cached?.users.map((user) => [String(user.id), user]));
    if (
      !cached ||
      cached.expires <= Date.now() ||
      clockings.some(
        (punch) => !byId.get(String(punch.user_id))?.profile?.personnel_id,
      )
    ) {
      const users = await provider.list<RadanUser>('/V1/Users', 'users');
      cached = { users, expires: Date.now() + 15 * 60000 };
      this.userCache.set(source, cached);
      byId.clear();
      for (const user of users) byId.set(String(user.id), user);
    }
    const { users } = cached;
    const codes = users
      .map((u) => digits(String(u.profile?.personnel_id ?? '')).trim())
      .filter(Boolean);
    if (new Set(codes).size !== codes.length)
      throw new Error('Ambiguous provider personnel codes');
    let skipped = 0;
    let invalid = 0;
    const punches = clockings.flatMap((p) => {
      const user = byId.get(String(p.user_id));
      const personnelCode = String(user?.profile?.personnel_id ?? '').trim();
      if (
        config.personnelCodes &&
        !config.personnelCodes.includes(digits(personnelCode))
      ) {
        skipped++;
        return [];
      }
      const match =
        /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::([0-5]\d))?$/.exec(
          p.datetime ?? '',
        );
      if (
        !personnelCode ||
        !match ||
        !['in', 'out', 'indeterminate'].includes(p.entry_type)
      ) {
        invalid++;
        return [];
      }
      let date: string;
      try {
        date = new Date(
          isoDate(match[1]!).getTime() +
            (config.dateCorrectedFrom && match[1]! >= config.dateCorrectedFrom
              ? 0
              : dateOffsetDays) *
              86400000,
        )
          .toISOString()
          .slice(0, 10);
      } catch {
        invalid++;
        return [];
      }
      if (date < from || date > to) return [];
      let occurredAt: string;
      try {
        const stamp = new Date(
          localClockToUtc(date, match[2]!).getTime() +
            Number(match[3] ?? 0) * 1000,
        );
        occurredAt = stamp.toISOString();
        if (stamp.getTime() > Date.now()) {
          invalid++;
          return [];
        }
      } catch {
        invalid++;
        return [];
      }

      const kind =
        p.entry_type === 'in'
          ? 'ورود'
          : p.entry_type === 'out'
            ? 'خروج'
            : 'اعلام حضور';
      return [
        {
          id: String(p.id),
          personnelCode: digits(personnelCode),
          date,
          time: match[2]!,
          occurredAt,
          kind,
          accepted:
            p.status === 'accepted' &&
            (p.type_id === undefined || p.type_id === 159),
        },
      ];
    });
    let created = 0,
      updated = 0,
      imported = 0,
      unchanged = 0,
      unmatched = 0,
      closed = 0;
    const dates = new Set<string>();
    const moved = this.pending.get(source) ?? new Map<string, Set<string>>();
    this.pending.set(source, moved);
    for (let i = 0; i < punches.length; i += 500) {
      const result = await this.hr.importDevicePunches(
        { branchId, source, punches: punches.slice(i, i + 500) },
        randomUUID(),
        actor,
        scheduled,
        nightly,
      );
      created += result.created ?? 0;
      updated += result.updated ?? 0;
      imported += result.imported;
      unchanged += result.unchanged;
      unmatched += result.unmatched;
      closed += result.closed;
      result.dates.forEach((d) => dates.add(d));
      for (const item of result.reconcile ?? []) {
        const ids = moved.get(item.date) ?? new Set<string>();
        ids.add(item.employeeId);
        moved.set(item.date, ids);
      }
    }
    for (const date of moved.keys()) dates.add(date);
    for (const date of [...dates].sort()) {
      await this.hr.processAttendance(
        { branchId, date },
        randomUUID(),
        actor,
        true,
        [...(moved.get(date) ?? [])],
        scheduled ? [...(moved.get(date) ?? [])] : undefined,
        scheduled,
      );
      moved.delete(date);
    }
    if (nightly) this.reconciledOn.set(source, today);
    const result = {
      branchId,
      mode: scheduled && !nightly ? 'recent' : 'full',
      state: 'ready',
      at: new Date().toISOString(),
      from,
      to,
      created,
      updated,
      imported,
      unchanged,
      unmatched,
      closed,
      invalid,
      skipped,
      days: dates.size,
      sourceUsers: users.length,
      sourceClockings: clockings.length,
    };
    this.lastSuccess.set(source, result);
    return result;
  }
}
