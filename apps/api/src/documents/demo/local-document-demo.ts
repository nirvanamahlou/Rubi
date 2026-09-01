import { createHash } from 'node:crypto';
import { parse, resolve } from 'node:path';

import { ConfigService } from '@nestjs/config';
import {
  AuditOutcome,
  createDatabaseClient,
  DocumentArchiveStatus,
  DocumentProcessingStatus,
  DocumentQuarantineStatus,
  DocumentScanStatus,
  type DatabaseClient,
} from '@rubi/database';

import type { LocalAntivirusResult } from '../documents.antivirus';
import { WindowsDefenderAntivirus } from '../documents.antivirus';
import { LocalDocumentStorage } from '../documents.storage';
import {
  documentDemoFixtures,
  type DocumentDemoFixture,
} from './document-demo-fixtures';

export const DOCUMENTS_DEMO_SOURCE_MODULE = 'documents-demo';
const DOCUMENTS_DEMO_SOURCE_ENTITY_TYPE = 'SyntheticDocumentFixture';
const DOCUMENTS_DEMO_ADVISORY_LOCK = 830_310_4;

type DemoClient = Pick<
  DatabaseClient,
  | 'user'
  | 'documentType'
  | 'documentCategory'
  | 'document'
  | 'documentVersion'
  | 'documentRelation'
  | 'documentQuarantine'
  | 'documentProcessingJob'
  | 'documentAuditEvent'
>;

export interface DocumentsDemoAntivirus {
  readonly available: boolean;
  scan(contents: Buffer, safeFileName: string): Promise<LocalAntivirusResult>;
}

export interface DocumentsDemoStorage {
  putQuarantined(objectKey: string, contents: Buffer): Promise<void>;
  readQuarantined(
    objectKey: string,
    expectedSizeBytes: number,
  ): Promise<Buffer>;
  removeQuarantined(objectKey: string): Promise<void>;
}

export interface DocumentsDemoReport {
  applied: boolean;
  created: number;
  reused: number;
  repairedFiles: number;
  antivirusAvailable: boolean;
  records: Array<{
    key: string;
    id: string;
    title: string;
    domain: string;
    scanStatus: string;
  }>;
}

export interface SeedLocalDocumentsDemoInput {
  databaseUrl: string;
  environment: string;
  storageRoot: string;
  storageEncryptionKeyBase64: string;
  antivirusMode: string;
  antivirusCommand?: string;
  username: string;
  branchCode?: string;
  apply: boolean;
  now?: Date;
  antivirus?: DocumentsDemoAntivirus;
  storage?: DocumentsDemoStorage;
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

function assertEncryptionKey(value: string): void {
  if (Buffer.from(value, 'base64').length !== 32) {
    throw new Error(
      'DOCUMENTS_STORAGE_ENCRYPTION_KEY_BASE64 must be a base64 32-byte key.',
    );
  }
}

export function assertLocalDocumentsDemoTarget(
  databaseUrl: string,
  environment: string,
  storageRoot: string,
): void {
  const url = new URL(databaseUrl);
  if (
    url.hash ||
    [...url.searchParams].some(
      ([key, value]) => key !== 'schema' || value !== 'public',
    )
  ) {
    throw new Error('Connection overrides are not permitted for demo data.');
  }
  if (environment !== 'development' && environment !== 'test') {
    throw new Error('Documents demo data is restricted to development/test.');
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.port !== '55432' ||
    !/^\/(?:rubi|rubi_documents_demo_test_[a-f0-9]{32})$/.test(url.pathname)
  ) {
    throw new Error(
      'Only the explicitly named local Rubi database is allowed for Documents demo data.',
    );
  }
  const trimmedStorageRoot = storageRoot.trim();
  if (!trimmedStorageRoot) {
    throw new Error('DOCUMENTS_STORAGE_ROOT is required.');
  }
  const resolvedStorage = resolve(trimmedStorageRoot);
  if (
    resolvedStorage === parse(resolvedStorage).root ||
    /^[A-Za-z]:[\\/]*$/.test(trimmedStorageRoot) ||
    /^[\\/]{2}/.test(trimmedStorageRoot)
  ) {
    throw new Error('Documents demo storage must be a scoped local directory.');
  }
}

async function loadPrerequisites(
  client: DemoClient,
  fixtures: readonly DocumentDemoFixture[],
  username: string,
  branchCode?: string,
) {
  const actor = await client.user.findFirst({
    where: {
      username: { equals: username.trim(), mode: 'insensitive' },
      status: 'ACTIVE',
      roles: {
        some: { role: { code: 'administrator', isActive: true } },
      },
    },
    select: {
      id: true,
      username: true,
      branches: {
        where: {
          branch: {
            isActive: true,
            ...(branchCode ? { code: branchCode.trim() } : {}),
          },
        },
        select: {
          isPrimary: true,
          grantedAt: true,
          branch: { select: { id: true, code: true } },
        },
        orderBy: [{ isPrimary: 'desc' }, { grantedAt: 'asc' }],
      },
    },
  });
  if (!actor) {
    throw new Error(
      `Active administrator ${username.trim() || '(empty)'} was not found. The demo command never creates IAM accounts.`,
    );
  }
  const branch = actor.branches[0]?.branch;
  if (!branch) {
    throw new Error(
      branchCode
        ? `Administrator has no active access to branch ${branchCode}.`
        : 'Administrator has no active branch access.',
    );
  }

  const typeCodes = [
    ...new Set(fixtures.map((fixture) => fixture.documentTypeCode)),
  ];
  const categoryCodes = [
    ...new Set(fixtures.map((fixture) => fixture.categoryCode)),
  ];
  const [types, categories] = await Promise.all([
    client.documentType.findMany({
      where: { code: { in: typeCodes }, isActive: true },
    }),
    client.documentCategory.findMany({
      where: { code: { in: categoryCodes }, isActive: true },
    }),
  ]);
  const typeByCode = new Map(types.map((type) => [type.code, type]));
  const categoryByCode = new Map(
    categories.map((category) => [category.code, category]),
  );
  const missingTypes = typeCodes.filter((code) => !typeByCode.has(code));
  const missingCategories = categoryCodes.filter(
    (code) => !categoryByCode.has(code),
  );
  if (missingTypes.length || missingCategories.length) {
    throw new Error(
      `Documents reference seed is missing (${[
        ...missingTypes,
        ...missingCategories,
      ].join(', ')}). Apply migrations and the ordinary Prisma seed first.`,
    );
  }
  for (const fixture of fixtures) {
    const type = typeByCode.get(fixture.documentTypeCode)!;
    if (type.domain !== fixtureDomain(fixture)) {
      throw new Error(
        `Document type ${type.code} has unexpected domain ${type.domain}.`,
      );
    }
    if (!type.allowedMimeTypes.includes('image/png')) {
      throw new Error(`Document type ${type.code} does not allow image/png.`);
    }
  }
  return { actor, branch, typeByCode, categoryByCode };
}

function fixtureDomain(fixture: DocumentDemoFixture): string {
  if (
    fixture.documentTypeCode === 'PASSPORT' ||
    fixture.documentTypeCode === 'CUSTOMER_DOCUMENT'
  )
    return 'CUSTOMER_IDENTITY';
  if (
    fixture.documentTypeCode === 'QUOTATION' ||
    fixture.documentTypeCode === 'CONTRACT'
  )
    return 'SALES';
  if (fixture.documentTypeCode === 'VOUCHER') return 'TRAVEL';
  if (fixture.documentTypeCode === 'PROCUREMENT_DOCUMENT') return 'PROCUREMENT';
  if (fixture.documentTypeCode === 'HR_DOCUMENT') return 'HUMAN_RESOURCES';
  throw new Error(`Unknown demo document type ${fixture.documentTypeCode}.`);
}

function fixtureStorageObjectKey(fixture: DocumentDemoFixture): string {
  return `documents/${fixture.documentId}/v1/${fixture.storageFileId}.bin`;
}

async function existingFixtures(
  client: DemoClient,
  fixtures: readonly DocumentDemoFixture[],
) {
  const rows = await client.document.findMany({
    where: {
      sourceModule: DOCUMENTS_DEMO_SOURCE_MODULE,
      sourceEntityType: DOCUMENTS_DEMO_SOURCE_ENTITY_TYPE,
      sourceEntityId: { in: fixtures.map((fixture) => fixture.sourceEntityId) },
    },
    include: { currentVersion: true, documentType: true },
  });
  const bySource = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!row.sourceEntityId || bySource.has(row.sourceEntityId)) {
      throw new Error(
        'Duplicate or invalid Documents demo marker detected; no records were changed.',
      );
    }
    bySource.set(row.sourceEntityId, row);
  }
  return bySource;
}

function reportRecord(
  fixture: DocumentDemoFixture,
  id: string,
  domain: string,
  scanStatus: string,
) {
  return {
    key: fixture.key,
    id,
    title: fixture.title,
    domain,
    scanStatus,
  };
}

async function ensureFixtureFile(
  storage: DocumentsDemoStorage,
  fixture: DocumentDemoFixture,
): Promise<boolean> {
  const objectKey = fixtureStorageObjectKey(fixture);
  const expectedHash = createHash('sha256')
    .update(fixture.contents)
    .digest('hex');
  try {
    const current = await storage.readQuarantined(
      objectKey,
      fixture.contents.length,
    );
    const currentHash = createHash('sha256').update(current).digest('hex');
    if (currentHash !== expectedHash) {
      throw new Error(
        `Existing encrypted demo file failed hash verification: ${fixture.key}.`,
      );
    }
    return false;
  } catch (error) {
    if (!isMissingFile(error)) throw error;
    await storage.putQuarantined(objectKey, fixture.contents);
    return true;
  }
}

function defaultAdapters(input: SeedLocalDocumentsDemoInput) {
  const config = new ConfigService({
    DOCUMENTS_STORAGE_ROOT: input.storageRoot,
    DOCUMENTS_STORAGE_ENCRYPTION_KEY_BASE64: input.storageEncryptionKeyBase64,
    DOCUMENTS_ANTIVIRUS_MODE: input.antivirusMode,
    DOCUMENTS_ANTIVIRUS_COMMAND: input.antivirusCommand,
  });
  return {
    storage: input.storage ?? new LocalDocumentStorage(config),
    antivirus: input.antivirus ?? new WindowsDefenderAntivirus(config),
  };
}

export async function seedLocalDocumentsDemo(
  input: SeedLocalDocumentsDemoInput,
): Promise<DocumentsDemoReport> {
  assertLocalDocumentsDemoTarget(
    input.databaseUrl,
    input.environment,
    input.storageRoot,
  );
  assertEncryptionKey(input.storageEncryptionKeyBase64);
  const fixtures = documentDemoFixtures(input.now);
  const { storage, antivirus } = defaultAdapters(input);
  const database = createDatabaseClient(input.databaseUrl);
  const baseReport: DocumentsDemoReport = {
    applied: input.apply,
    created: 0,
    reused: 0,
    repairedFiles: 0,
    antivirusAvailable: antivirus.available,
    records: [],
  };
  const newlyWrittenKeys: string[] = [];
  try {
    const prerequisites = await loadPrerequisites(
      database,
      fixtures,
      input.username,
      input.branchCode,
    );
    const before = await existingFixtures(database, fixtures);
    if (!input.apply) {
      for (const fixture of fixtures) {
        const existing = before.get(fixture.sourceEntityId);
        const domain = fixtureDomain(fixture);
        if (existing) baseReport.reused++;
        else baseReport.created++;
        baseReport.records.push(
          reportRecord(
            fixture,
            existing?.id ?? fixture.documentId,
            domain,
            existing?.currentVersion?.scanStatus ?? 'CLEAN_AFTER_REAL_SCAN',
          ),
        );
      }
      return baseReport;
    }
    if (!antivirus.available) {
      throw new Error(
        'Documents demo apply requires an available local antivirus adapter; no records or files were created.',
      );
    }

    const scanResults = new Map<string, LocalAntivirusResult>();
    for (const fixture of fixtures) {
      if (before.has(fixture.sourceEntityId)) continue;
      const scan = await antivirus.scan(
        fixture.contents,
        fixture.originalFileName,
      );
      if (scan.status !== 'CLEAN') {
        throw new Error(
          `Antivirus rejected Documents demo fixture ${fixture.key} (${scan.threatCode ?? scan.status}); no records or files were created.`,
        );
      }
      scanResults.set(fixture.key, scan);
    }

    return await database.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${DOCUMENTS_DEMO_ADVISORY_LOCK})`;
        const client = transaction as unknown as DemoClient;
        const currentPrerequisites = await loadPrerequisites(
          client,
          fixtures,
          prerequisites.actor.username,
          input.branchCode,
        );
        const current = await existingFixtures(client, fixtures);
        const report: DocumentsDemoReport = {
          ...baseReport,
          records: [],
        };
        for (const fixture of fixtures) {
          const existing = current.get(fixture.sourceEntityId);
          if (existing) {
            if (
              existing.currentVersion?.storageObjectKey ===
                fixtureStorageObjectKey(fixture) &&
              existing.currentVersion.sha256 ===
                createHash('sha256').update(fixture.contents).digest('hex')
            ) {
              const restored = await ensureFixtureFile(storage, fixture);
              if (restored) {
                newlyWrittenKeys.push(fixtureStorageObjectKey(fixture));
                report.repairedFiles++;
              }
            }
            report.reused++;
            report.records.push(
              reportRecord(
                fixture,
                existing.id,
                existing.documentType.domain,
                existing.currentVersion?.scanStatus ?? 'UNKNOWN',
              ),
            );
            continue;
          }

          const scan =
            scanResults.get(fixture.key) ??
            (await antivirus.scan(fixture.contents, fixture.originalFileName));
          if (scan.status !== 'CLEAN') {
            throw new Error(
              `Antivirus did not return CLEAN for ${fixture.key}; the transaction was rolled back.`,
            );
          }
          const wroteFile = await ensureFixtureFile(storage, fixture);
          if (wroteFile)
            newlyWrittenKeys.push(fixtureStorageObjectKey(fixture));
          const documentType = currentPrerequisites.typeByCode.get(
            fixture.documentTypeCode,
          )!;
          const category = currentPrerequisites.categoryByCode.get(
            fixture.categoryCode,
          )!;
          const sha256 = createHash('sha256')
            .update(fixture.contents)
            .digest('hex');
          await transaction.document.create({
            data: {
              id: fixture.documentId,
              title: fixture.title,
              description: fixture.description,
              documentTypeId: documentType.id,
              categoryId: category.id,
              branchId: currentPrerequisites.branch.id,
              ownerUserId: currentPrerequisites.actor.id,
              sourceModule: DOCUMENTS_DEMO_SOURCE_MODULE,
              sourceEntityType: DOCUMENTS_DEMO_SOURCE_ENTITY_TYPE,
              sourceEntityId: fixture.sourceEntityId,
              confidentiality: fixture.confidentiality,
              archiveStatus: DocumentArchiveStatus.ACTIVE,
              validUntil: fixture.validUntil,
              currentVersionNumber: 0,
              createdByUserId: currentPrerequisites.actor.id,
              updatedByUserId: currentPrerequisites.actor.id,
              createdAt: fixture.createdAt,
              updatedAt: fixture.createdAt,
            },
          });
          await transaction.documentVersion.create({
            data: {
              id: fixture.versionId,
              documentId: fixture.documentId,
              versionNumber: 1,
              storageObjectKey: fixtureStorageObjectKey(fixture),
              originalFileName: fixture.originalFileName,
              safeDownloadName: fixture.originalFileName,
              detectedMimeType: 'image/png',
              extension: 'png',
              sizeBytes: BigInt(fixture.contents.length),
              sha256,
              scanStatus: DocumentScanStatus.CLEAN,
              versionNote: 'نسخه اولیه داده نمایشی ساختگی',
              createdByUserId: currentPrerequisites.actor.id,
              createdAt: fixture.createdAt,
            },
          });
          await transaction.documentRelation.create({
            data: {
              documentId: fixture.documentId,
              relationType: 'PRIMARY_CASE',
              sourceModule: DOCUMENTS_DEMO_SOURCE_MODULE,
              sourceEntityType: fixture.sourceEntityType,
              sourceEntityId: fixture.sourceEntityId,
              displayLabel: fixture.sourceDisplayLabel,
              createdAt: fixture.createdAt,
            },
          });
          await transaction.documentQuarantine.create({
            data: {
              versionId: fixture.versionId,
              status: DocumentQuarantineStatus.RELEASED,
              reasonCode: 'ANTIVIRUS_SCAN_CLEAN',
              quarantinedAt: fixture.createdAt,
              reviewedAt: scan.scannedAt,
              reviewReason: `${scan.engineVersion} · ${scan.adapterReference}`,
            },
          });
          await transaction.documentProcessingJob.create({
            data: {
              versionId: fixture.versionId,
              jobType: 'ANTIVIRUS_SCAN',
              status: DocumentProcessingStatus.COMPLETED,
              attempts: 1,
              availableAt: scan.scannedAt,
              createdAt: fixture.createdAt,
              updatedAt: scan.scannedAt,
            },
          });
          await transaction.document.update({
            where: { id: fixture.documentId },
            data: {
              currentVersionId: fixture.versionId,
              currentVersionNumber: 1,
            },
          });
          await transaction.documentAuditEvent.createMany({
            data: [
              {
                documentId: fixture.documentId,
                versionId: fixture.versionId,
                actorUserId: currentPrerequisites.actor.id,
                actorBranchId: currentPrerequisites.branch.id,
                action: 'documents.demo.upload',
                outcome: AuditOutcome.SUCCESS,
                reason: 'EXPLICIT_LOCAL_SYNTHETIC_DEMO',
                ipSummary: 'local-system',
                userAgentSummary: 'documents-demo-bootstrap',
                occurredAt: fixture.createdAt,
              },
              {
                documentId: fixture.documentId,
                versionId: fixture.versionId,
                actorUserId: currentPrerequisites.actor.id,
                actorBranchId: currentPrerequisites.branch.id,
                action: 'documents.antivirus.scan',
                outcome: AuditOutcome.SUCCESS,
                reason: 'LOCAL_ANTIVIRUS_CLEAN',
                ipSummary: 'local-system',
                userAgentSummary: scan.engineVersion.slice(0, 240),
                occurredAt: scan.scannedAt,
              },
            ],
          });
          report.created++;
          report.records.push(
            reportRecord(
              fixture,
              fixture.documentId,
              documentType.domain,
              DocumentScanStatus.CLEAN,
            ),
          );
        }
        return report;
      },
      { maxWait: 10_000, timeout: 180_000 },
    );
  } catch (error) {
    for (const objectKey of newlyWrittenKeys.reverse()) {
      await storage.removeQuarantined(objectKey).catch(() => undefined);
    }
    throw error;
  } finally {
    await database.$disconnect();
  }
}
