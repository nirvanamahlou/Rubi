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

@Injectable()
export class HrRadanDeviceService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(HrRadanDeviceService.name);
  private latest: Record<string, unknown> = { state: 'idle' };
  constructor(
    @Inject(HrService) private readonly hr: HrService,
    @Inject(IamService) private readonly iam: IamService,
  ) {}
  onModuleInit() {
    if (process.env.HR_RADAN_ENABLED !== 'true') return;
    this.timer = setInterval(() => void this.tick(), 120000);
    this.timer.unref();
    void this.tick();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  private async tick() {
    try {
      const actor = await this.iam.authenticateSessionReferenceV1(
        process.env.HR_RADAN_ACTOR_ID ?? '',
        process.env.HR_RADAN_SESSION_ID ?? '',
        true,
      );
      await this.sync(actor);
    } catch {
      this.latest = { state: 'error', at: new Date().toISOString() };
      this.logger.warn(
        'Attendance synchronization failed; check provider, scope and session configuration.',
      );
    }
  }
  status(actor: AuthenticatedActor) {
    this.authorize(actor);
    return this.latest;
  }
  private authorize(actor: AuthenticatedActor) {
    const branchId = process.env.HR_RADAN_BRANCH_ID;
    if (!branchId)
      throw new ServiceUnavailableException(
        'Attendance connector is not configured',
      );
    if (
      !actor.permissions.includes('hr.manage') ||
      !actor.branchIds.includes(branchId)
    )
      throw new ForbiddenException('مجوز منابع انسانی وجود ندارد.');
    return branchId;
  }
  async sync(actor: AuthenticatedActor) {
    const branchId = this.authorize(actor);
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
    this.running = true;
    try {
      const provider = new RadanDeviceClient(base, username, password);
      await provider.login();
      const users = await provider.list<RadanUser>('/V1/Users', 'users');
      const clockings = await provider.list<RadanPunch>(
        '/V1/Ta/Clockings',
        'clockings',
      );
      const byId = new Map(users.map((u) => [String(u.id), u]));
      const codes = users
        .map((u) => digits(String(u.profile?.personnel_id ?? '')).trim())
        .filter(Boolean);
      if (new Set(codes).size !== codes.length)
        throw new Error('Ambiguous provider personnel codes');
      const today = localClockParts(new Date()).date;
      const from = new Date(isoDate(today).getTime() - 31 * 86400000)
        .toISOString()
        .slice(0, 10);
      const source = `radan:${branchId}`;
      let invalid = 0;
      const punches = clockings.flatMap((p) => {
        const user = byId.get(String(p.user_id));
        const personnelCode = String(user?.profile?.personnel_id ?? '').trim();
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
        if (match[1]! < from || match[1]! > today) return [];
        try {
          const stamp = localClockToUtc(match[1]!, match[2]!);
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
            date: match[1]!,
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
      }
      for (const date of [...dates].sort())
        await this.hr.processAttendance(
          { branchId, date },
          randomUUID(),
          actor,
          true,
        );
      this.latest = {
        state: 'ready',
        at: new Date().toISOString(),
        from,
        to: today,
        imported,
        unchanged,
        unmatched,
        closed,
        invalid,
        days: dates.size,
        sourceUsers: users.length,
        sourceClockings: clockings.length,
      };
      return this.latest;
    } finally {
      this.running = false;
    }
  }
}
