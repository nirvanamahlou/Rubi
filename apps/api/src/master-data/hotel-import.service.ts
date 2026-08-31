import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedActor } from '@rubi/contracts';
import { AuditOutcome, MasterHotelImportStatus } from '@rubi/database';
import type {
  MasterHotelImportDuplicateBehavior,
  Prisma,
} from '@rubi/database';
import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import {
  mkdir,
  readFile,
  readdir,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { DatabaseService } from '../database/database.service';
import type { HotelImportCommitDto } from './hotel-import.dto';
import {
  HOTEL_IMPORT_TEMPLATE_VERSION,
  parseHotelImportWorkbook,
  type HotelImportSourceRow,
} from './hotel-import.parser';

const PREVIEW_TTL_MS = 15 * 60 * 1000;
const STAGING_TTL_MS = 60 * 60 * 1000;
const MAX_RATE_WINDOW_MS = 60 * 1000;
const MAX_PREVIEWS_PER_WINDOW = 5;
const MAX_COMMITS_PER_WINDOW = 10;

function sha256(value: Uint8Array | string) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizedCode(value: string) {
  return value.normalize('NFKC').trim().toUpperCase();
}

function derivedCode(prefix: string, value: string) {
  const normalized = value
    .normalize('NFKC')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
  return normalized.length >= 2
    ? normalized
    : `${prefix}_${sha256(value).slice(0, 12).toUpperCase()}`;
}

function safeSnapshot(row: HotelImportSourceRow) {
  return {
    code: row.code,
    englishName: row.englishName,
    city: row.city,
    starRating: row.starRating,
    mealServiceCode: row.mealServiceCode,
    defaultRoomType: row.defaultRoomType,
    facilityCount: row.facilities.length,
    isActive: row.isActive,
  };
}

function branchOf(actor: AuthenticatedActor, requested?: string) {
  const branchId = requested ?? actor.branchIds[0];
  if (!branchId || !actor.branchIds.includes(branchId))
    throw new ForbiddenException('شعبه مجاز برای Import مشخص نشده است.');
  return branchId;
}

@Injectable()
export class HotelImportService implements OnModuleDestroy {
  private readonly stagingDirectory = join(
    tmpdir(),
    'rubi-master-data-imports',
  );
  private readonly rateWindows = new Map<string, number[]>();
  private readonly tokenKey: Buffer;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(ConfigService) config: ConfigService,
  ) {
    this.tokenKey = Buffer.from(
      config.getOrThrow<string>('MASTER_DATA_IMPORT_TOKEN_KEY_BASE64'),
      'base64',
    );
    if (this.tokenKey.length !== 32)
      throw new Error('MASTER_DATA_IMPORT_TOKEN_KEY_BASE64 must be 32 bytes.');
    this.cleanupTimer = setInterval(
      () => void this.cleanupExpired(),
      10 * 60 * 1000,
    );
    this.cleanupTimer.unref();
  }

  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  private rateLimit(actorUserId: string, action: 'preview' | 'commit') {
    const key = `${actorUserId}:${action}`;
    const now = Date.now();
    const recent = (this.rateWindows.get(key) ?? []).filter(
      (timestamp) => now - timestamp < MAX_RATE_WINDOW_MS,
    );
    const limit =
      action === 'preview' ? MAX_PREVIEWS_PER_WINDOW : MAX_COMMITS_PER_WINDOW;
    if (recent.length >= limit)
      throw new BadRequestException({
        code: 'HOTEL_IMPORT_RATE_LIMITED',
        message: 'تعداد درخواست‌های Import بیش از حد مجاز است.',
      });
    recent.push(now);
    this.rateWindows.set(key, recent);
  }

  private tokenHash(token: string) {
    return createHmac('sha256', this.tokenKey).update(token).digest('hex');
  }

  private verifyToken(token: string, expectedHash: string) {
    const actual = Buffer.from(this.tokenHash(token), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }

  private async cleanupExpired() {
    await mkdir(this.stagingDirectory, { recursive: true });
    const now = Date.now();
    for (const name of await readdir(this.stagingDirectory)) {
      const path = join(this.stagingDirectory, basename(name));
      const metadata = await stat(path).catch(() => null);
      if (metadata && now - metadata.mtimeMs > STAGING_TTL_MS)
        await unlink(path).catch(() => undefined);
    }
    await this.database.client.masterHotelImportSession.updateMany({
      where: {
        status: MasterHotelImportStatus.PREVIEW_READY,
        previewExpiresAt: { lt: new Date() },
      },
      data: { status: MasterHotelImportStatus.EXPIRED },
    });
  }

  async preview(
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    input: { countryId: string; cityId: string; templateVersion: string },
    actor: AuthenticatedActor,
    requestedBranch?: string,
    traceId?: string,
  ) {
    this.rateLimit(actor.userId, 'preview');
    if (!file?.buffer || file.size !== file.buffer.byteLength)
      throw new BadRequestException('فایل Upload معتبر نیست.');
    if (input.templateVersion !== HOTEL_IMPORT_TEMPLATE_VERSION)
      throw new BadRequestException('نسخه Template پشتیبانی نمی‌شود.');
    const city = await this.database.client.masterCity.findFirst({
      where: {
        id: input.cityId,
        countryId: input.countryId,
        isActive: true,
        country: { isActive: true },
      },
      include: { country: true },
    });
    if (!city)
      throw new BadRequestException(
        'کشور و شهر فعال با Scope انتخاب‌شده یافت نشد.',
      );

    const parsed = parseHotelImportWorkbook({
      buffer: file.buffer,
      fileName: file.originalname,
      mimeType: file.mimetype,
      expectedCityName: city.name,
    });
    const codes = parsed.rows.map((row) => row.code);
    const duplicates = await this.database.client.masterHotel.findMany({
      where: { code: { in: codes } },
      select: { id: true, code: true, version: true, name: true },
    });
    const duplicateByCode = new Map(duplicates.map((row) => [row.code, row]));
    const duplicateRows = parsed.rows
      .filter((row) => duplicateByCode.has(row.code))
      .map((row) => ({
        rowNumber: row.rowNumber,
        code: row.code,
        currentVersion: duplicateByCode.get(row.code)!.version,
      }));

    await mkdir(this.stagingDirectory, { recursive: true });
    await this.cleanupExpired();
    const stagingFileName = `${randomUUID()}.xlsx`;
    const stagingPath = join(this.stagingDirectory, stagingFileName);
    await writeFile(stagingPath, file.buffer, { flag: 'wx', mode: 0o600 });
    const previewToken = randomBytes(32).toString('base64url');
    const previewExpiresAt = new Date(Date.now() + PREVIEW_TTL_MS);
    const fileHash = sha256(file.buffer);
    try {
      const session = await this.database.client.$transaction(async (tx) => {
        const created = await tx.masterHotelImportSession.create({
          data: {
            templateVersion: HOTEL_IMPORT_TEMPLATE_VERSION,
            fileHash,
            originalFileName: basename(file.originalname).slice(0, 255),
            stagingFileName,
            actorUserId: actor.userId,
            actorBranchId: branchOf(actor, requestedBranch),
            countryId: input.countryId,
            cityId: input.cityId,
            previewTokenHash: this.tokenHash(previewToken),
            previewExpiresAt,
            mappingSnapshot: parsed.mapping,
            malwareScanStatus: parsed.security.malwareScanStatus,
            rowCount: parsed.rows.length,
            validCount:
              parsed.rows.length -
              new Set(
                parsed.issues.map((issue) => issue.rowNumber).filter(Boolean),
              ).size,
            invalidCount: new Set(
              parsed.issues.map((issue) => issue.rowNumber).filter(Boolean),
            ).size,
            duplicateCount: duplicateRows.length,
            errorReport: JSON.parse(
              JSON.stringify({
                issues: parsed.issues,
                warnings: parsed.warnings,
              }),
            ) as Prisma.InputJsonValue,
            traceId: traceId ?? null,
          },
        });
        await tx.masterDataAuditEvent.create({
          data: {
            actorUserId: actor.userId,
            actorBranchId: branchOf(actor, requestedBranch),
            action: 'master_data.hotel_import.preview',
            resource: 'hotel-imports',
            entityId: created.id,
            outcome: AuditOutcome.SUCCESS,
            afterSnapshot: {
              fileHash,
              templateVersion: HOTEL_IMPORT_TEMPLATE_VERSION,
              rowCount: parsed.rows.length,
              duplicateCount: duplicateRows.length,
              malwareScanStatus: parsed.security.malwareScanStatus,
            },
            traceId: traceId ?? null,
          },
        });
        return created;
      });
      return {
        data: {
          sessionId: session.id,
          previewToken,
          previewExpiresAt: previewExpiresAt.toISOString(),
          templateVersion: HOTEL_IMPORT_TEMPLATE_VERSION,
          scope: {
            countryId: input.countryId,
            cityId: input.cityId,
            country: city.country.name,
            city: city.name,
          },
          mapping: parsed.mapping,
          security: parsed.security,
          counts: {
            rows: parsed.rows.length,
            invalid: session.invalidCount,
            duplicates: duplicateRows.length,
          },
          rows: parsed.rows.slice(0, 100).map((row) => ({
            ...safeSnapshot(row),
            rowNumber: row.rowNumber,
            duplicate: duplicateByCode.has(row.code),
          })),
          issues: parsed.issues,
          warnings: parsed.warnings,
          duplicates: duplicateRows,
          previewTruncated: parsed.rows.length > 100,
          atomicCommit: true,
        },
      };
    } catch (error) {
      await unlink(stagingPath).catch(() => undefined);
      throw error;
    }
  }

  async commit(
    sessionId: string,
    input: HotelImportCommitDto,
    actor: AuthenticatedActor,
    requestedBranch?: string,
    traceId?: string,
  ) {
    this.rateLimit(actor.userId, 'commit');
    if (input.duplicateBehavior === 'CREATE_NEW')
      throw new BadRequestException(
        'CREATE_NEW برای کد تکراری بدون Mapping کد جدید مجاز نیست.',
      );
    const session =
      await this.database.client.masterHotelImportSession.findFirst({
        where: { id: sessionId, actorUserId: actor.userId },
        include: { city: true },
      });
    if (!session) throw new NotFoundException('Import Session یافت نشد.');
    if (session.status === MasterHotelImportStatus.COMPLETED)
      return { data: this.sessionResult(session) };
    if (session.status !== MasterHotelImportStatus.PREVIEW_READY)
      throw new ConflictException('Import Session قابل Commit نیست.');
    if (session.previewExpiresAt <= new Date())
      throw new ConflictException('Preview Token منقضی شده است.');
    if (!this.verifyToken(input.previewToken, session.previewTokenHash))
      throw new ForbiddenException('Preview Token معتبر نیست.');
    const idempotencyKeyHash = this.tokenHash(input.idempotencyKey);
    const existingIdempotency =
      await this.database.client.masterHotelImportSession.findFirst({
        where: { idempotencyKeyHash },
      });
    if (existingIdempotency && existingIdempotency.id !== session.id)
      throw new ConflictException({
        code: 'HOTEL_IMPORT_IDEMPOTENCY_CONFLICT',
        message: 'Idempotency Key قبلاً استفاده شده است.',
      });

    const stagingPath = join(
      this.stagingDirectory,
      basename(session.stagingFileName),
    );
    const buffer = await readFile(stagingPath).catch(() => null);
    if (!buffer || sha256(buffer) !== session.fileHash)
      throw new ConflictException('فایل Staging حذف یا تغییر کرده است.');
    const parsed = parseHotelImportWorkbook({
      buffer,
      fileName: session.originalFileName,
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      expectedCityName: session.city.name,
    });
    if (parsed.issues.length)
      throw new BadRequestException({
        code: 'HOTEL_IMPORT_REVALIDATION_FAILED',
        message: 'اعتبارسنجی مجدد Commit ناموفق بود.',
        details: parsed.issues,
      });

    const completed = await this.database.client.$transaction(async (tx) => {
      const claimed = await tx.masterHotelImportSession.updateMany({
        where: {
          id: session.id,
          status: MasterHotelImportStatus.PREVIEW_READY,
        },
        data: {
          status: MasterHotelImportStatus.COMMITTING,
          idempotencyKeyHash,
          duplicateBehavior:
            input.duplicateBehavior as MasterHotelImportDuplicateBehavior,
          traceId: traceId ?? null,
        },
      });
      if (claimed.count !== 1)
        throw new ConflictException({
          code: 'CONCURRENT_MODIFICATION',
          message: 'Import هم‌زمان Commit شده است.',
        });
      let createdCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      for (const row of parsed.rows) {
        const existing = await tx.masterHotel.findUnique({
          where: { code: row.code },
        });
        let affectedHotelId = existing?.id ?? null;
        if (existing && input.duplicateBehavior === 'SKIP') {
          skippedCount += 1;
          continue;
        }
        const references = await this.resolveReferences(
          tx,
          row,
          actor.userId,
          input.createMissingReferences,
        );
        if (existing) {
          const updated = await tx.masterHotel.updateMany({
            where: { id: existing.id, version: existing.version },
            data: {
              name: row.englishName,
              englishName: row.englishName,
              cityId: session.cityId,
              address: row.address,
              description: row.description,
              hotelRules: row.hotelRules,
              starRating: row.starRating,
              mealServiceId: references.mealServiceId,
              defaultRoomTypeId: references.roomTypeId,
              isSaleableReference: row.isActive,
              isActive: row.isActive,
              updatedByUserId: actor.userId,
              version: { increment: 1 },
            },
          });
          if (updated.count !== 1)
            throw new ConflictException({
              code: 'CONCURRENT_MODIFICATION',
              message: `هتل ${row.code} هم‌زمان تغییر کرده است.`,
            });
          await tx.masterHotelFacility.deleteMany({
            where: { hotelId: existing.id },
          });
          await this.assignFacilities(
            tx,
            existing.id,
            references.facilityIds,
            actor.userId,
          );
          updatedCount += 1;
        } else {
          const hotel = await tx.masterHotel.create({
            data: {
              code: normalizedCode(row.code),
              name: row.englishName,
              englishName: row.englishName,
              cityId: session.cityId,
              address: row.address,
              description: row.description,
              hotelRules: row.hotelRules,
              starRating: row.starRating,
              mealServiceId: references.mealServiceId,
              defaultRoomTypeId: references.roomTypeId,
              isSaleableReference: row.isActive,
              isActive: row.isActive,
              createdByUserId: actor.userId,
              updatedByUserId: actor.userId,
            },
          });
          affectedHotelId = hotel.id;
          await this.assignFacilities(
            tx,
            hotel.id,
            references.facilityIds,
            actor.userId,
          );
          createdCount += 1;
        }
        await tx.masterDataAuditEvent.create({
          data: {
            actorUserId: actor.userId,
            actorBranchId: branchOf(actor, requestedBranch),
            action: existing
              ? 'master_data.hotel_import.update'
              : 'master_data.hotel_import.create',
            resource: 'hotels',
            entityId: affectedHotelId,
            outcome: AuditOutcome.SUCCESS,
            afterSnapshot: safeSnapshot(row),
            traceId: traceId ?? null,
          },
        });
      }
      const result = await tx.masterHotelImportSession.update({
        where: { id: session.id },
        data: {
          status: MasterHotelImportStatus.COMPLETED,
          createdCount,
          updatedCount,
          skippedCount,
          committedAt: new Date(),
          errorReport: JSON.parse(
            JSON.stringify({ issues: [], warnings: parsed.warnings }),
          ) as Prisma.InputJsonValue,
        },
      });
      await tx.masterDataAuditEvent.create({
        data: {
          actorUserId: actor.userId,
          actorBranchId: branchOf(actor, requestedBranch),
          action: 'master_data.hotel_import.commit',
          resource: 'hotel-imports',
          entityId: session.id,
          outcome: AuditOutcome.SUCCESS,
          afterSnapshot: {
            fileHash: session.fileHash,
            createdCount,
            updatedCount,
            skippedCount,
            duplicateBehavior: input.duplicateBehavior,
          },
          traceId: traceId ?? null,
        },
      });
      return result;
    });
    await unlink(stagingPath).catch(() => undefined);
    return { data: this.sessionResult(completed) };
  }

  private sessionResult(session: {
    id: string;
    status: MasterHotelImportStatus;
    rowCount: number;
    validCount: number;
    invalidCount: number;
    duplicateCount: number;
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    committedAt: Date | null;
  }) {
    return {
      sessionId: session.id,
      status: session.status,
      counts: {
        rows: session.rowCount,
        valid: session.validCount,
        invalid: session.invalidCount,
        duplicates: session.duplicateCount,
        created: session.createdCount,
        updated: session.updatedCount,
        skipped: session.skippedCount,
      },
      committedAt: session.committedAt?.toISOString() ?? null,
    };
  }

  private async resolveReferences(
    tx: Prisma.TransactionClient,
    row: HotelImportSourceRow,
    actorUserId: string,
    createMissing: boolean,
  ) {
    let mealServiceId: string | null = null;
    let roomTypeId: string | null = null;
    const facilityIds: string[] = [];
    if (row.mealServiceCode) {
      const code = derivedCode('MEAL', row.mealServiceCode);
      let reference = await tx.masterMealService.findUnique({
        where: { code },
      });
      if (!reference && createMissing)
        reference = await tx.masterMealService.create({
          data: {
            code,
            name: row.mealServiceCode,
            englishName: row.mealServiceCode,
            includedMeals: [],
            createdByUserId: actorUserId,
            updatedByUserId: actorUserId,
          },
        });
      if (!reference?.isActive)
        throw new BadRequestException(
          `سرویس فعال ${row.mealServiceCode} یافت نشد.`,
        );
      mealServiceId = reference.id;
    }
    if (row.defaultRoomType) {
      const code = derivedCode('ROOM', row.defaultRoomType);
      let reference = await tx.masterRoomType.findUnique({ where: { code } });
      if (!reference && createMissing)
        reference = await tx.masterRoomType.create({
          data: {
            code,
            name: row.defaultRoomType,
            englishName: row.defaultRoomType,
            createdByUserId: actorUserId,
            updatedByUserId: actorUserId,
          },
        });
      if (!reference?.isActive)
        throw new BadRequestException(
          `نوع اتاق فعال ${row.defaultRoomType} یافت نشد.`,
        );
      roomTypeId = reference.id;
    }
    for (const name of row.facilities) {
      const code = derivedCode('FAC', name);
      let reference = await tx.masterFacility.findUnique({ where: { code } });
      if (!reference && createMissing)
        reference = await tx.masterFacility.create({
          data: {
            code,
            name,
            createdByUserId: actorUserId,
            updatedByUserId: actorUserId,
          },
        });
      if (!reference?.isActive)
        throw new BadRequestException(`امکان فعال ${name} یافت نشد.`);
      facilityIds.push(reference.id);
    }
    return { mealServiceId, roomTypeId, facilityIds };
  }

  private async assignFacilities(
    tx: Prisma.TransactionClient,
    hotelId: string,
    facilityIds: readonly string[],
    actorUserId: string,
  ) {
    if (!facilityIds.length) return;
    await tx.masterHotelFacility.createMany({
      data: facilityIds.map((facilityId) => ({
        hotelId,
        facilityId,
        assignedByUserId: actorUserId,
      })),
      skipDuplicates: true,
    });
  }
}
