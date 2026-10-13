import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Injectable,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import { AuthGuard } from '../iam/auth.guard';
import { PermissionGuard } from '../iam/permission.guard';
import { RequireAccessControls } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { getRequestId } from '../common/request-id.middleware';
import { maskIp } from './system-management.validation';

const brands = { niayesh: 'NS', jahan: 'JB', ghesti: 'GR' } as const;
export function correspondenceDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return ['year', 'month', 'day'].map(
    (type) => parts.find((part) => part.type === type)!.value,
  );
}
export function validateCorrespondenceNumberInput(input: {
  companyId?: unknown;
  date?: unknown;
  idempotencyKey?: unknown;
}) {
  if (
    !input ||
    typeof input.companyId !== 'string' ||
    !Object.hasOwn(brands, input.companyId)
  )
    throw new BadRequestException('شرکت نامه معتبر نیست.');
  if (
    typeof input.idempotencyKey !== 'string' ||
    !/^[a-f0-9-]{36}$/i.test(input.idempotencyKey)
  )
    throw new BadRequestException('شناسه درخواست نامه معتبر نیست.');
  if (typeof input.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.date))
    throw new BadRequestException('تاریخ نامه معتبر نیست.');
  const date = new Date(`${input.date}T12:00:00+03:30`);
  if (
    !Number.isFinite(date.valueOf()) ||
    date.toISOString().slice(0, 10) !== input.date
  )
    throw new BadRequestException('تاریخ نامه معتبر نیست.');
  return {
    companyId: input.companyId as keyof typeof brands,
    date,
    idempotencyKey: input.idempotencyKey,
  };
}
function present(value: string) {
  const [, year, month, day] = value.split('/');
  return {
    contract: 'correspondence.number.v1' as const,
    number: value,
    date: `${year}/${month}/${day}`,
  };
}

// This producer owns System numbering aggregates; correspondence never writes Documents tables.
@Injectable()
export class CorrespondenceNumberingService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  async issue(
    input: { companyId?: unknown; date?: unknown; idempotencyKey?: unknown },
    actorUserId: string,
    requestId?: string,
    ipAddress?: string,
  ) {
    const { companyId, date, idempotencyKey } =
      validateCorrespondenceNumberInput(input);
    const [year, month, day] = correspondenceDateParts(date);
    const code = `CORRESPONDENCE_OUTGOING_${companyId.toUpperCase()}`;
    return this.database.client.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${code}, 0))`,
      );
      const scheme = await tx.systemNumberingScheme.upsert({
        where: { code_scopeKey: { code, scopeKey: 'GLOBAL' } },
        update: {},
        create: {
          code,
          scope: 'GLOBAL',
          scopeKey: 'GLOBAL',
          prefix: brands[companyId],
          calendar: 'JALALI',
          padding: 6,
          resetPolicy: 'YEARLY',
          includeFiscalYear: true,
          reason: 'Correspondence outgoing automatic numbering',
          createdByUserId: actorUserId,
        },
      });
      if (!scheme.isActive)
        throw new BadRequestException('طرح شماره‌گذاری فعال یافت نشد.');
      const key = `${actorUserId}:${idempotencyKey}`;
      const existing = await tx.systemIssuedNumber.findUnique({
        where: {
          schemeId_idempotencyKey: { schemeId: scheme.id, idempotencyKey: key },
        },
      });
      if (existing) return present(existing.issuedValue);
      const sequence = await tx.systemNumberingSequence.upsert({
        where: {
          schemeId_periodKey: { schemeId: scheme.id, periodKey: year! },
        },
        create: { schemeId: scheme.id, periodKey: year!, lastValue: 1n },
        update: { lastValue: { increment: 1n }, version: { increment: 1 } },
      });
      const value = `${brands[companyId]}/${year}/${month}/${day}/${sequence.lastValue.toString().padStart(6, '0')}`;
      const issued = await tx.systemIssuedNumber.create({
        data: {
          schemeId: scheme.id,
          idempotencyKey: key,
          issuedValue: value,
          sequenceValue: sequence.lastValue,
          periodKey: year!,
          actorUserId,
        },
      });
      await tx.systemAuditEvent.create({
        data: {
          actorUserId,
          action: 'correspondence.number.issue',
          entityType: 'SystemIssuedNumber',
          entityId: issued.id,
          outcome: 'SUCCESS',
          reason: 'Atomic outgoing letter number',
          before: Prisma.JsonNull,
          after: { companyId, number: value },
          requestId: requestId ?? null,
          ipAddressMasked: maskIp(ipAddress),
        },
      });
      return present(value);
    });
  }
}
@Controller('correspondence/v1')
@UseGuards(AuthGuard, PermissionGuard)
@RequireAccessControls('correspondence.home')
export class CorrespondenceNumberingController {
  constructor(
    @Inject(CorrespondenceNumberingService)
    private readonly numbering: CorrespondenceNumberingService,
  ) {}
  @Post('numbers')
  issue(
    @Body()
    input: { companyId?: unknown; date?: unknown; idempotencyKey?: unknown },
    @Req() request: AuthenticatedRequest,
  ) {
    return this.numbering.issue(
      input,
      request.actor.userId,
      getRequestId(request),
      request.ip,
    );
  }
}
