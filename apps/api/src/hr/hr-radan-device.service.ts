import { nextRadanSyncAt } from './hr-radan-sync-schedule';
import { attendanceFrom } from './hr-attendance-range';
import {
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
};

@Injectable()
export class HrRadanDeviceService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = true;
  private nextSyncAt: string | null = null;
  private running = false;
  private readonly fullSyncAt = new Map<string, number>();
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
      const startedAt = Date.now();
      const result = await this.sync(actor, true);
      this.logger.log(
        `Attendance poll completed: ${String(result.state)} (${Date.now() - startedAt}ms)`,
      );
    } catch {
      this.latest = { state: 'error', at: new Date().toISOString() };
      this.logger.warn(
        'Attendance synchronization failed; check provider, scope and session configuration.',
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
        state: sources.every((s) => s.state === 'ready') ? 'ready' : 'partial',
      };
    } else if (
      latest.branchId &&
      !actor.branchIds.includes(String(latest.branchId))
    ) {
      latest = { state: 'idle' };
    }
    return {
      ...latest,
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
  async sync(actor: AuthenticatedActor, scheduled = false) {
    this.authorize(actor);
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
            ...(await this.syncSource(source, actor, scheduled)),
            branchId: source.branchId,
          });
        } catch (error) {
          if (sources.length === 1) throw error;
          results.push({
            state: 'error',
            branchId: source.branchId,
            at: new Date().toISOString(),
          });
          this.logger.warn(
            'An attendance source failed; other sources continue independently.',
          );
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
  private async syncSource(
    config: DeviceSource,
    actor: AuthenticatedActor,
    scheduled: boolean,
  ) {
    const { base, username, password, branchId, dateOffsetDays } = config;
    const provider = new RadanDeviceClient(base, username, password);
    await provider.login();
    const users = await provider.list<RadanUser>('/V1/Users', 'users');
    const today = localClockParts(new Date()).date;
    const source = config.source ?? `radan:${branchId}`;
    const full =
      !scheduled || Date.now() - (this.fullSyncAt.get(source) ?? 0) >= 3600000;
    const from = full
      ? attendanceFrom(
          new Date(isoDate(today).getTime() - 31 * 86400000)
            .toISOString()
            .slice(0, 10),
        )
      : attendanceFrom(
          new Date(isoDate(today).getTime() - 86400000)
            .toISOString()
            .slice(0, 10),
        );
    const rawFrom = new Date(
      isoDate(from).getTime() - dateOffsetDays * 86400000,
    )
      .toISOString()
      .slice(0, 10);
    const clockings = await provider.list<RadanPunch>(
      '/V1/Ta/Clockings',
      'clockings',
      full ? undefined : rawFrom,
    );
    const byId = new Map(users.map((u) => [String(u.id), u]));
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
      const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::\d{2})?$/.exec(
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
          isoDate(match[1]!).getTime() + dateOffsetDays * 86400000,
        )
          .toISOString()
          .slice(0, 10);
      } catch {
        invalid++;
        return [];
      }
      if (date < from || date > today) return [];
      try {
        const stamp = localClockToUtc(date, match[2]!);
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
          kind,
          accepted:
            p.status === 'accepted' &&
            (p.type_id === undefined || p.type_id === 159),
        },
      ];
    });
    let imported = 0,
      unchanged = 0,
      unmatched = 0,
      closed = 0;
    const dates = new Set<string>();
    const moved = new Map<string, Set<string>>();
    for (let i = 0; i < punches.length; i += 500) {
      const result = await this.hr.importDevicePunches(
        { branchId, source, punches: punches.slice(i, i + 500) },
        randomUUID(),
        actor,
      );
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
    // Also process days without punches so weekly absences and rest days are visible.
    for (let day = Date.parse(from); day <= Date.parse(today); day += 86400000)
      dates.add(new Date(day).toISOString().slice(0, 10));
    for (const date of [...dates].sort())
      await this.hr.processAttendance(
        { branchId, date },
        randomUUID(),
        actor,
        true,
        [...(moved.get(date) ?? [])],
      );
    if (full) this.fullSyncAt.set(source, Date.now());
    return {
      mode: full ? 'full' : 'recent',
      state: 'ready',
      at: new Date().toISOString(),
      from,
      to: today,
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
  }
}
