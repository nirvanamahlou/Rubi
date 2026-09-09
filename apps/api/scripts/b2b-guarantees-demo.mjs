// Additive local fixtures through public owner services. No approvals or IAM grants.
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url);
require('reflect-metadata');
const { ConfigService } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt');
const { createDatabaseClient } = require('@rubi/database');
const { IamService } = require('../dist/iam/iam.service.js');
const { MfaTotpService } = require('../dist/iam/mfa-totp.js');
const {
  MasterDataService,
} = require('../dist/master-data/master-data.service.js');
const {
  MasterDataRepository,
} = require('../dist/master-data/master-data.repository.js');
const {
  MasterDataContactCrypto,
} = require('../dist/master-data/master-data-contact.crypto.js');
const {
  MasterOrganizationDirectory,
} = require('../dist/master-data/master-organization-directory.js');
const {
  NotificationsService,
} = require('../dist/notifications/notifications.service.js');
const {
  NotificationsRepository,
} = require('../dist/notifications/notifications.repository.js');
const { DocumentsService } = require('../dist/documents/documents.service.js');
const {
  DocumentsRepository,
} = require('../dist/documents/documents.repository.js');
const {
  LocalDocumentStorage,
} = require('../dist/documents/documents.storage.js');
const {
  DocumentsScanProcessor,
} = require('../dist/documents/documents.scan-processor.js');
const {
  WindowsDefenderAntivirus,
} = require('../dist/documents/documents.antivirus.js');
const {
  B2bAgreementDocuments,
} = require('../dist/b2b/b2b-agreement-documents.js');
const {
  B2bAgreementWorkflowRepository,
} = require('../dist/b2b/b2b-agreement-workflow.repository.js');
const {
  B2bAgreementWorkflowService,
} = require('../dist/b2b/b2b-agreement-workflow.service.js');
const [mode, databaseName, actorId] = process.argv.slice(2);
if (
  !['--preview', '--apply', '--verify'].includes(mode) ||
  !/^rubi_hr_current_\d{8}$/.test(databaseName ?? '') ||
  !/^[0-9a-f-]{36}$/i.test(actorId ?? '') ||
  process.argv.length !== 5
)
  throw Error(
    'Usage: --preview|--apply|--verify local_database existing_operator_uuid',
  );
const url = new URL(process.env.DATABASE_URL ?? '');
if (
  !['localhost', '127.0.0.1'].includes(url.hostname) ||
  url.port !== '55432' ||
  !['postgres:', 'postgresql:'].includes(url.protocol) ||
  url.hash ||
  [...url.searchParams].some(
    ([key, value]) => key !== 'schema' || value !== 'public',
  ) ||
  process.env.NODE_ENV === 'production'
)
  throw Error('Verified local development database only');
url.pathname = '/' + databaseName;
const client = createDatabaseClient(url.toString()),
  db = { client },
  config = new ConfigService(process.env);
try {
  const iam = new IamService(db, new JwtService(), new MfaTotpService(config));
  const user = (await iam.listUsers()).find(
    (u) => u.id === actorId && u.status === 'ACTIVE',
  );
  if (!user) throw Error('Existing active operator required');
  const { roles } = await iam.listRolesAndBranches();
  // Offline audit attribution from existing grants only; no session/token is issued.
  const actor = {
    userId: user.id,
    sessionId: randomUUID(),
    branchIds: user.branches.map((x) => x.branch.id),
    permissions: [
      ...new Set(
        roles
          .filter((r) => user.roles.some((x) => x.role.id === r.id))
          .flatMap((r) => r.permissions.map((x) => x.permission.code)),
      ),
    ],
  };
  for (const p of [
    'master_data.read',
    'documents.upload',
    'documents.list',
    'documents.organization.read',
    'documents.metadata.read',
    'b2b.agreement.read',
    'b2b.agreement.manage',
    'b2b.credit.read',
    'b2b.credit.manage',
  ])
    if (!actor.permissions.includes(p))
      throw Error('Existing permission required: ' + p);
  const branchId = actor.branchIds[0];
  if (!branchId) throw Error('Authorized branch required');
  const master = new MasterDataService(
    new MasterDataRepository(db),
    new MasterDataContactCrypto(config),
  );
  const list = async (resource, search = '') =>
    (
      await master.list(resource, {
        search,
        status: 'active',
        sortBy: 'code',
        sortDirection: 'asc',
        page: 1,
        pageSize: 100,
      })
    ).data;
  const directory = new MasterOrganizationDirectory(db);
  const repository = new DocumentsRepository(
    db,
    new NotificationsService(new NotificationsRepository(db)),
  );
  const storage = new LocalDocumentStorage(config);
  const scanner = new DocumentsScanProcessor(
    repository,
    storage,
    new WindowsDefenderAntivirus(config),
  );
  const documents = new DocumentsService(repository, storage, scanner, iam);
  const workflow = new B2bAgreementWorkflowService(
    new B2bAgreementWorkflowRepository(db),
    directory,
    new B2bAgreementDocuments(documents),
  );
  const options = (await documents.options(actor)).data;
  const type = options.documentTypes.find(
    (t) =>
      t.domain === 'ORGANIZATION' && t.allowedMimeTypes.includes('image/png'),
  );
  const category =
    options.categories.find((c) => c.code === 'ORGANIZATION') ??
    options.categories[0];
  const method = (await list('payment-methods'))[0];
  if (
    !type ||
    !category ||
    !method ||
    (await directory.activeCurrencyCodes(['IRR', 'USD'])).length !== 2
  )
    throw Error('Required document/payment/currency references unavailable');
  const names = [
    'آژانس آزمایشی افق سفر',
    'آژانس آزمایشی آبیراه',
    'آژانس آزمایشی آسمان',
    'آژانس آزمایشی نیلگون',
  ];
  const plan = [];
  for (const [index, name] of names.entries()) {
    const org = (await list('organizations', name)).find(
      (o) =>
        o.name === name &&
        String(o.attributes.roleCodes).split(',').includes('AGENCY'),
    );
    if (!org) throw Error('Existing synthetic agency missing: ' + name);
    const agreements = [];
    for (let page = 1; ; page++) {
      const response = await workflow.list(
        org.id,
        branchId,
        'AGENCY',
        actor,
        page,
        100,
      );
      agreements.push(...response.data);
      if (agreements.length >= response.meta.total) break;
    }
    const title = `قرارداد نمونه تضمین‌های آژانس ${index + 1}`;
    plan.push({
      org,
      index,
      title,
      existing: agreements.find((a) => a.title === title),
    });
  }
  let created = 0,
    uploaded = 0,
    reused = 0;
  const buffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6O0AAAAASUVORK5CYII=',
    'base64',
  );
  for (const item of plan) {
    if (item.existing) {
      reused++;
      continue;
    }
    if (mode === '--verify')
      throw Error('Expected demo contract missing: ' + item.title);
    if (mode !== '--apply') continue;
    const { org, index, title } = item;
    const docRows = [];
    for (let page = 1; ; page++) {
      const result = await documents.list(
        {
          sourceModule: 'master-data',
          sourceEntityType: 'organizations',
          sourceEntityId: org.id,
          branchId,
          domain: 'ORGANIZATION',
          archiveStatus: 'ACTIVE',
          validity: 'ALL',
          page,
          pageSize: 100,
        },
        actor,
      );
      docRows.push(...result.data);
      if (result.data.length < 100) break;
    }
    const proofIds = [];
    for (const label of ['ضمانت‌نامه بانکی', 'چک تضمین']) {
      const proofTitle = `مدرک آزمایشی ${label} — ${org.name}`;
      const previous = docRows.find((d) => d.title === proofTitle);
      if (previous) {
        proofIds.push(previous.id);
        continue;
      }
      const proof = (
        await documents.upload(
          {
            title: proofTitle,
            documentTypeId: type.id,
            categoryId: category.id,
            branchId,
            ownerUserId: actor.userId,
            confidentiality: type.defaultConfidentiality,
            sourceModule: 'master-data',
            sourceEntityType: 'organizations',
            sourceEntityId: org.id,
            sourceDisplayLabel: org.code,
            validUntil: '2027-08-31T23:59:59.999Z',
            requiresStepUpVerification: false,
          },
          {
            buffer,
            originalname: 'synthetic-guarantee.png',
            mimetype: 'image/png',
            size: buffer.length,
          },
          actor,
          {
            ipAddress: '127.0.0.1',
            userAgent: 'B2B-CONTRACT-CREDIT-DEMO-001 synthetic seed',
          },
        )
      ).data;
      proofIds.push(proof.id);
      uploaded++;
    }
    await workflow.save(
      org.id,
      undefined,
      {
        branchId,
        role: 'AGENCY',
        requestId: randomUUID(),
        terms: {
          title,
          agreementType: 'AGENCY',
          startsAt: '2026-09-01',
          endsAt: '2027-08-31',
          currencyCodes: ['IRR', 'USD'],
          services: ['FLIGHT', 'HOTEL', 'TOUR'],
          paymentMethod: 'CREDIT',
          paymentMethodId: method.id,
          settlementCycle: 'MONTHLY',
          settlementDays: 15,
          cutoffDay: 25,
          slaHours: 24,
          cancellationTerms: 'شرایط نمونه برای بررسی فرم',
          refundTerms: 'شرایط نمونه برای بررسی فرم',
          notes:
            'داده آزمایشی؛ اعتبار فعال، دریافت وجه یا تأیید ضمانت ایجاد نمی‌کند.',
          changeReason: 'ثبت نمونه اعتبار و تضمین پرونده ۳۶۰',
          documentId: null,
          creditPolicies: ['IRR', 'USD'].map((currencyCode) => ({
            currencyCode,
            creditLimit:
              currencyCode === 'IRR'
                ? String(1000000000 + index * 250000000)
                : String(10000 + index * 2500),
            limitType: 'HARD',
            dueDays: 15,
            overdueAction: 'BLOCK',
            effectiveFrom: '2026-09-01',
            expiresAt: '2027-08-31',
          })),
          guarantees: [
            {
              kind: 'BANK_GUARANTEE',
              reference: `DEMO-BANK-${index + 1}`,
              amount: String(300000000 + index * 50000000),
              currencyCode: 'IRR',
              issuer: 'بانک صادرکننده آزمایشی',
              receivedAt: '2026-09-01',
              expiresAt: '2027-08-31',
              status: 'REQUIRED',
              documentId: proofIds[0],
            },
            {
              kind: 'CHEQUE',
              reference: `DEMO-CHEQUE-${index + 1}`,
              amount: String(100000000 + index * 25000000),
              currencyCode: 'IRR',
              issuer: 'صادرکننده چک آزمایشی',
              receivedAt: '2026-09-01',
              expiresAt: '2027-05-31',
              status: 'REQUIRED',
              documentId: proofIds[1],
            },
            {
              kind: 'DEPOSIT_REQUIREMENT',
              reference: `DEMO-DEPOSIT-${index + 1}`,
              amount: String(2000 + index * 500),
              currencyCode: 'USD',
              issuer: 'شرط سپرده آزمایشی',
              receivedAt: '2026-09-01',
              expiresAt: '2027-08-31',
              status: 'REQUIRED',
              documentId: null,
            },
          ],
        },
      },
      actor,
    );
    created++;
  }
  const report = [];
  if (mode !== '--preview')
    for (const item of plan) {
      const records = await workflow.list(
        item.org.id,
        branchId,
        'AGENCY',
        actor,
        1,
        100,
      );
      const record = records.data.find((r) => r.title === item.title);
      if (!record) throw Error('Saved fixture missing');
      const revision = record.revisions[0];
      if (
        !revision ||
        revision.guarantees.length < 3 ||
        revision.creditPolicies.length < 2
      )
        throw Error(
          'Fixture was edited or incomplete; not overwritten: ' + item.title,
        );
      const proofs = revision.guarantees.filter((g) => g.documentVersionId);
      if (proofs.length < 2) throw Error('Expected proof links missing');
      report.push({
        organization: item.org.name,
        agreementId: record.id,
        status: revision.status,
        guarantees: revision.guarantees.length,
        proofs: proofs.length,
      });
    }
  console.log(
    JSON.stringify(
      {
        mode,
        database: databaseName,
        created,
        uploaded,
        reused,
        pending:
          mode === '--preview' ? plan.filter((x) => !x.existing).length : 0,
        records: report,
        iamGrantsChanged: false,
        automaticApprovals: false,
      },
      null,
      2,
    ),
  );
} finally {
  await client.$disconnect();
}
