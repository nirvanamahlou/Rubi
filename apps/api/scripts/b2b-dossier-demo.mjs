// Additive local fixtures. Domain writes use their public owner services.
// Existing matching records are reused without changing user edits or approvals.
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url);
require('reflect-metadata');
const { ConfigService } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt');
const { createDatabaseClient } = require('@rubi/database');
const {
  MasterDataRepository,
} = require('../dist/master-data/master-data.repository.js');
const {
  MasterDataService,
} = require('../dist/master-data/master-data.service.js');
const {
  MasterDataContactCrypto,
} = require('../dist/master-data/master-data-contact.crypto.js');
const {
  MasterOrganizationDirectory,
} = require('../dist/master-data/master-organization-directory.js');
const { IamService } = require('../dist/iam/iam.service.js');
const { MfaTotpService } = require('../dist/iam/mfa-totp.js');
const { B2bRepository } = require('../dist/b2b/b2b.repository.js');
const { B2bService } = require('../dist/b2b/b2b.service.js');
const {
  B2bAgreementDocuments,
} = require('../dist/b2b/b2b-agreement-documents.js');
const {
  B2bAgreementWorkflowRepository,
} = require('../dist/b2b/b2b-agreement-workflow.repository.js');
const {
  B2bAgreementWorkflowService,
} = require('../dist/b2b/b2b-agreement-workflow.service.js');
const [mode, databaseName, actorId, branchId] = process.argv.slice(2);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (
  !['--preview', '--apply'].includes(mode) ||
  !/^rubi_hr_current_\d{8}$/.test(databaseName ?? '') ||
  !uuid.test(actorId ?? '') ||
  !uuid.test(branchId ?? '') ||
  process.argv.length !== 6
)
  throw new Error(
    'Usage: --preview|--apply local_database existing_fixture_actor_uuid branch_uuid',
  );
const url = new URL(process.env.DATABASE_URL ?? '');
if (
  !['postgres:', 'postgresql:'].includes(url.protocol) ||
  !['localhost', '127.0.0.1'].includes(url.hostname) ||
  url.port !== '55432' ||
  url.hash ||
  [...url.searchParams].some(
    ([key, value]) => key !== 'schema' || value !== 'public',
  ) ||
  process.env.NODE_ENV === 'production'
)
  throw new Error(
    'Only local development PostgreSQL on port 55432 is permitted.',
  );
url.pathname = `/${databaseName}`;
const client = createDatabaseClient(url.toString());
const database = { client };
const names = [
  'آژانس آزمایشی افق سفر',
  'آژانس آزمایشی آبیراه',
  'آژانس آزمایشی آسمان',
  'آژانس آزمایشی نیلگون',
];
try {
  const config = new ConfigService(process.env);
  const master = new MasterDataService(
    new MasterDataRepository(database),
    new MasterDataContactCrypto(config),
  );
  const directory = new MasterOrganizationDirectory(database);
  const iam = new IamService(
    database,
    new JwtService(),
    new MfaTotpService(config),
  );
  const fixtureActor = (await iam.listUsers()).find(
    (user) =>
      user.id === actorId &&
      user.status === 'ACTIVE' &&
      /ساختگی|آزمایشی|fixture/i.test(user.displayName) &&
      user.branches.some(({ branch }) => branch.id === branchId),
  );
  if (!fixtureActor)
    throw new Error(
      'An existing active synthetic fixture identity in the selected branch is required. No IAM account or grant is created.',
    );
  // Offline seed attribution only. No session is issued and IAM grants are unchanged.
  const actor = {
    userId: actorId,
    sessionId: randomUUID(),
    branchIds: [branchId],
    permissions: [
      'master_data.read',
      'master_data.create',
      'master_data.update',
      'b2b.agency.read',
      'b2b.agency.manage',
      'b2b.rate.read',
      'b2b.rate.manage',
      'b2b.agreement.read',
      'b2b.agreement.manage',
      'b2b.credit.read',
      'b2b.credit.manage',
    ],
  };
  // This fixture has no Documents or Finance data; fail closed if a reference is introduced.
  const unavailableDocuments = new Proxy(
    {},
    {
      get() {
        return () => {
          throw new Error('Document references are not part of this fixture.');
        };
      },
    },
  );
  const documents = new B2bAgreementDocuments(unavailableDocuments);
  const agency = new B2bService(
    new B2bRepository(database),
    directory,
    {
      getPartyExposure() {
        throw new Error('Financial projections are not fixtures.');
      },
    },
    documents,
    iam,
  );
  const workflow = new B2bAgreementWorkflowService(
    new B2bAgreementWorkflowRepository(database),
    directory,
    documents,
  );
  async function list(resource, search = '') {
    const rows = [];
    for (let page = 1; ; page++) {
      const response = await master.list(resource, {
        search,
        status: 'all',
        sortBy: 'code',
        sortDirection: 'asc',
        page,
        pageSize: 100,
      });
      rows.push(...response.data);
      if (rows.length >= response.meta.total) return rows;
    }
  }
  const country = (await list('countries', 'ایران')).find(
    (row) => row.code === 'IR' && row.status === 'active',
  );
  const city = (await list('cities', 'تهران')).find(
    (row) =>
      row.code === 'TEHRAN' &&
      row.status === 'active' &&
      row.attributes.countryId === country?.id,
  );
  if (
    !country ||
    !city ||
    (await directory.activeCurrencyCodes(['IRR', 'USD'])).length !== 2
  )
    throw new Error(
      'Active Iran/Tehran and IRR/USD reference data are required.',
    );
  const plan = [];
  for (const [index, legalName] of names.entries()) {
    const org = (await list('organizations', legalName)).find(
      (row) => row.name === legalName,
    );
    if (
      !org ||
      org.status !== 'active' ||
      !String(org.attributes.roleCodes).split(',').includes('AGENCY')
    )
      throw new Error(
        `Missing or inactive synthetic agency: ${legalName}. Run the organization fixture first.`,
      );
    const existingAddresses = await directory.addresses(org.id);
    const existingContacts = (await list('organization-contacts')).filter(
      (row) => row.attributes.organizationId === org.id,
    );
    const details = (await agency.profileDetails(org.id, actor, branchId)).data;
    const rates = (await agency.rates(org.id, actor, branchId)).data;
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
    const item = { code: org.code, name: legalName, actions: [] };
    const add = (kind, write) => item.actions.push({ kind, write });
    if (!details.profile)
      add('profile', () =>
        agency.upsertProfile(
          org.id,
          {
            branchId,
            status: 'UNDER_REVIEW',
            displayOrder: index + 1,
            accountManagerUserId: actorId,
          },
          actor,
        ),
      );
    if (
      details.profile &&
      (!details.profile.isActive ||
        !['UNDER_REVIEW', 'ACTIVE'].includes(details.profile.status))
    )
      throw new Error(
        `Fixture profile is suspended or ended: ${org.code}; no overwrite allowed.`,
      );
    for (const [position, label] of [
      'دفتر مرکزی آزمایشی',
      'دفتر فروش آزمایشی',
    ].entries()) {
      if (!existingAddresses.some((row) => row.label === label))
        add('address', () =>
          directory.createAddress(
            org.id,
            {
              countryId: country.id,
              cityId: city.id,
              label,
              addressLine: `نشانی ساختگی برای آزمون پرونده ${index + 1}، خیابان نمونه، ساختمان آزمایشی ${position + 1}`,
              postalCode: null,
              isPrimary:
                !existingAddresses.some((row) => row.isPrimary) &&
                position === 0,
              displayOrder: position,
              isActive: true,
            },
            actor,
            branchId,
          ),
        );
    }
    for (const [position, jobTitle] of [
      'نماینده فروش',
      'نماینده مالی',
    ].entries()) {
      const fullName = `${jobTitle} آزمایشی ${index + 1}`;
      if (!existingContacts.some((row) => row.name === fullName))
        add('contact', () =>
          master.create(
            'organization-contacts',
            {
              organizationId: org.id,
              fullName,
              jobTitle,
              email: `agency-${index + 1}-${position + 1}@example.test`,
              preferredChannel: 'EMAIL',
              hasWhatsapp: false,
              isPrimary:
                position === 0 &&
                !existingContacts.some((row) => row.attributes.isPrimary),
            },
            actor,
          ),
        );
    }
    for (const [kind, title, serviceReference, value, currencyCode] of [
      [
        'FIXED_AMOUNT',
        'نرخ آزمایشی هتل',
        'HOTEL',
        String(25000000 + index * 5000000),
        'IRR',
      ],
      [
        'DISCOUNT_PERCENT',
        'تخفیف آزمایشی تور',
        'TOUR',
        String(5 + index),
        null,
      ],
      [
        'COMMISSION_PERCENT',
        'پورسانت آزمایشی پرواز',
        'FLIGHT',
        `${3 + index}.5`,
        null,
      ],
    ])
      if (!rates.some((row) => row.title === title && row.kind === kind))
        add('rate', () =>
          agency.createRate(
            org.id,
            {
              branchId,
              kind,
              title,
              serviceReference,
              value,
              currencyCode,
              validFrom: '2026-09-01',
              validTo: '2027-08-31',
              isActive: false,
            },
            actor,
          ),
        );
    const title = `قرارداد همکاری آزمایشی ${index + 1}`;
    if (!agreements.some((row) => row.title === title))
      add('agreement', () =>
        workflow.save(
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
              settlementCycle: 'MONTHLY',
              settlementDays: 15,
              cutoffDay: 25,
              slaHours: 24,
              cancellationTerms:
                'نمونه آزمایشی: هزینه لغو مطابق شرایط خدمت در زمان رزرو تعیین می‌شود.',
              refundTerms:
                'نمونه آزمایشی: استرداد پس از تأیید تأمین‌کننده انجام می‌شود.',
              notes:
                'داده ساختگی برای آزمایش فرم‌ها؛ تعهد یا اعتبار فعال ایجاد نمی‌کند.',
              changeReason: 'ایجاد داده آزمایشی پرونده ۳۶۰',
              documentId: null,
              creditPolicies: ['IRR', 'USD'].map((currencyCode) => ({
                currencyCode,
                creditLimit:
                  currencyCode === 'IRR'
                    ? String(1000000000 + index * 500000000)
                    : String(10000 + index * 5000),
                limitType: 'HARD',
                dueDays: 15,
                overdueAction: 'BLOCK',
                effectiveFrom: '2026-09-01',
                expiresAt: '2027-08-31',
              })),
              guarantees: [
                {
                  kind: 'DEPOSIT_REQUIREMENT',
                  reference: `B2B-DEMO-DEPOSIT-${index + 1}`,
                  amount: String(100000000 + index * 50000000),
                  currencyCode: 'IRR',
                  issuer: 'نمونه آزمایشی سپرده',
                  receivedAt: '2026-09-01',
                  expiresAt: '2027-08-31',
                  status: 'REQUIRED',
                  documentId: null,
                },
              ],
            },
          },
          actor,
        ),
      );
    plan.push(item);
  }
  // Preflight every organization before the first mutation. Each domain write is audited and transactional.
  const counts = {};
  for (const item of plan)
    for (const action of item.actions) {
      if (mode === '--apply') await action.write();
      counts[action.kind] = (counts[action.kind] ?? 0) + 1;
    }
  console.log(
    JSON.stringify(
      {
        mode,
        database: databaseName,
        agencies: plan.map(({ code, name, actions }) => ({
          code,
          name,
          changes: actions.length,
        })),
        [mode === '--apply' ? 'created' : 'pending']: counts,
        iamGrantsChanged: false,
        approvedAgreementsCreated: 0,
      },
      null,
      2,
    ),
  );
} finally {
  await client.$disconnect();
}
