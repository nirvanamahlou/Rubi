import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

import { JwtService } from '@nestjs/jwt';
import {
  HR_PERMISSION_CODES,
  type AuthenticatedActor,
  type HrRecordCreate,
} from '@rubi/contracts';
import { createDatabaseClient } from '@rubi/database';

import type { DatabaseService } from '../database/database.service';
import type { DocumentsService } from '../documents/documents.service';
import { IamService } from '../iam/iam.service';
import { HrService } from './hr.service';

/** Explicit, idempotent fictional local fixtures through the production HR commands. */
async function main() {
  const env = parseEnv(
    readFileSync(
      process.env.RUBI_HR_ENV_FILE ?? resolve(process.cwd(), '.env'),
      'utf8',
    ),
  );
  const url = new URL(env.DATABASE_URL!);
  if (
    env.NODE_ENV === 'production' ||
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    url.port !== '55432'
  )
    throw new Error('Only local development PostgreSQL is supported.');
  const client = createDatabaseClient(url.toString());
  try {
    const database = { client } as DatabaseService;
    const iam = new IamService(
      database,
      new JwtService({
        secret:
          env.IAM_ACCESS_TOKEN_SECRET ?? 'unused-local-seed-no-tokens-created',
      }),
    );
    const users = await iam.listUsers();
    const username = process.argv
      .find((arg) => arg.startsWith('--username='))
      ?.slice(11);
    const admin = users.find(
      (user) =>
        user.status === 'ACTIVE' &&
        user.roles.some((role) => role.role.code === 'administrator') &&
        (!username || user.username === username),
    );
    if (!admin)
      throw new Error('An existing active administrator is required.');
    const branchIds = admin.branches.map((row) => row.branch.id);
    const options = await iam.listRolesAndBranches();
    const branches = options.branches.filter((branch) =>
      branchIds.includes(branch.id),
    );
    if (!process.argv.includes('--apply')) {
      process.stdout.write(
        JSON.stringify({
          apply: false,
          branches: branches.map((b) => ({ id: b.id, name: b.name })),
          employees: branches.length * 6,
          existingUsersUnchanged: true,
        }) + '\n',
      );
      return;
    }
    const actor: AuthenticatedActor = {
      userId: admin.id,
      sessionId: admin.id,
      permissions: [...HR_PERMISSION_CODES],
      branchIds,
    };
    const documents = {
      detail: async () => {
        throw new Error('Demo fixtures do not create or attach documents.');
      },
    } as unknown as DocumentsService;
    const service = new HrService(database, iam, documents);
    let employees = 0,
      records = 0;
    const showcaseIds = new Set<string>();
    const showcaseByResource: Record<string, number> = {};
    const showcaseByStatus: Record<string, number> = {};
    let legacyOrganizationRowsUpdated = 0;
    let jahanOrganizationLabelsUpdated = 0;
    const organizationUnitCounts: Record<string, number> = {};
    for (const branch of branches) {
      const prefix = `hr-demo:v1:${branch.id}`;
      const create = async (label: string, body: HrRecordCreate) => {
        const result = await service.createRecord(
          { branchId: branch.id, ...body },
          `${prefix}:${label}`,
          actor,
        );
        records++;
        if (label.startsWith('showcase:')) {
          showcaseIds.add(result.id);
          const resource = `${result.section}.${result.tab}`;
          showcaseByResource[resource] =
            (showcaseByResource[resource] ?? 0) + 1;
          showcaseByStatus[result.status] =
            (showcaseByStatus[result.status] ?? 0) + 1;
        }
        return result;
      };
      const organizationBranches: string[] = [];
      for (const [label, company] of [
        ['niyayesh', 'نیایش سیر'],
        ['jahan', 'جهان باستان'],
      ] as const)
        organizationBranches.push(
          (
            await create(`company:${label}`, {
              section: 'organization',
              tab: 'branches',
              values: [company, `شرکت ${company}`, 'تهران', '—', '2026-01-01'],
              status: 'فعال',
            })
          ).id,
        );
      const unit = await create('unit', {
        section: 'organization',
        tab: 'units',
        values: [
          'واحد عملیات آزمایشی',
          'واحد',
          branch.name,
          '—',
          'مدیر آزمایشی',
          '2026-01-01',
        ],
        status: 'فعال',
      });
      const team = await create('team', {
        section: 'organization',
        tab: 'units',
        parentId: unit.id,
        values: [
          'تیم خدمات آزمایشی',
          'تیم',
          branch.name,
          'واحد عملیات آزمایشی',
          'مدیر آزمایشی',
          '2026-01-01',
        ],
        status: 'فعال',
      });
      // Preserve the original command bodies/keys above. Only untouched legacy
      // fixtures are eligible for this one-time classification and label repair.
      for (const [row, expectedValues, expectedParentId] of [
        [
          unit,
          [
            'واحد عملیات آزمایشی',
            'واحد',
            branch.name,
            '—',
            'مدیر آزمایشی',
            '2026-01-01',
          ],
          null,
        ],
        [
          team,
          [
            'تیم خدمات آزمایشی',
            'تیم',
            branch.name,
            'واحد عملیات آزمایشی',
            'مدیر آزمایشی',
            '2026-01-01',
          ],
          unit.id,
        ],
      ] as const) {
        if (
          row.version === 1 &&
          row.status === 'فعال' &&
          row.parentId === expectedParentId &&
          Object.keys(row.data).length === 0 &&
          JSON.stringify(row.values) === JSON.stringify(expectedValues)
        ) {
          const values = [...row.values];
          values[2] = 'نیایش سیر';
          await service.updateRecord(
            row.id,
            {
              version: row.version,
              values,
              data: { organizationBranchId: organizationBranches[0]! },
            },
            actor,
          );
          legacyOrganizationRowsUpdated++;
        }
      }
      const jahanUnit = await create('company-jahan-unit:v1', {
        section: 'organization',
        tab: 'units',
        values: [
          'واحد عملیات آزمایشی جهان باستان',
          'واحد',
          'جهان باستان',
          '—',
          'مدیر آزمایشی مهتاب',
          '2026-01-01',
        ],
        data: { organizationBranchId: organizationBranches[1]! },
        status: 'فعال',
      });
      const jahanTeam = await create('company-jahan-team:v1', {
        section: 'organization',
        tab: 'units',
        parentId: jahanUnit.id,
        values: [
          'تیم خدمات آزمایشی جهان باستان',
          'تیم',
          'جهان باستان',
          'واحد عملیات آزمایشی جهان باستان',
          'مدیر آزمایشی مهتاب',
          '2026-01-01',
        ],
        data: { organizationBranchId: organizationBranches[1]! },
        status: 'فعال',
      });
      // Match the existing employee assignment title within Jahan's own company.
      // Keep the original create payloads above unchanged for idempotent replay.
      for (const [row, expectedValues, expectedParentId, fieldIndex] of [
        [
          jahanUnit,
          [
            'واحد عملیات آزمایشی جهان باستان',
            'واحد',
            'جهان باستان',
            '—',
            'مدیر آزمایشی مهتاب',
            '2026-01-01',
          ],
          null,
          0,
        ],
        [
          jahanTeam,
          [
            'تیم خدمات آزمایشی جهان باستان',
            'تیم',
            'جهان باستان',
            'واحد عملیات آزمایشی جهان باستان',
            'مدیر آزمایشی مهتاب',
            '2026-01-01',
          ],
          jahanUnit.id,
          3,
        ],
      ] as const) {
        if (
          row.version === 1 &&
          row.status === 'فعال' &&
          row.parentId === expectedParentId &&
          Object.keys(row.data).length === 1 &&
          row.data.organizationBranchId === organizationBranches[1] &&
          JSON.stringify(row.values) === JSON.stringify(expectedValues)
        ) {
          const values = [...row.values];
          values[fieldIndex] = 'واحد عملیات آزمایشی';
          await service.updateRecord(
            row.id,
            { version: row.version, values },
            actor,
          );
          jahanOrganizationLabelsUpdated++;
        }
      }
      for (const [index, name] of ['نیایش سیر', 'جهان باستان'].entries()) {
        const result = await service.listRecords(
          {
            section: 'organization',
            tab: 'units',
            organizationBranchId: organizationBranches[index]!,
            pageSize: '1',
          },
          actor,
        );
        organizationUnitCounts[`${branch.code}:${name}`] = result.total;
      }
      await create('grade', {
        section: 'organization',
        tab: 'grades',
        values: ['رده آزمایشی G4', '4', '4', 'صرفاً داده نمایشی', '2026-01-01'],
        status: 'فعال',
      });
      let managerId: string | undefined;
      let appraisalCycleId: string | undefined;
      for (let index = 0; index < 6; index++) {
        const names = [
          'مدیر آزمایشی آفتاب',
          'همکار آزمایشی باران',
          'همکار آزمایشی سپیدار',
          'مدیر آزمایشی مهتاب',
          'همکار آزمایشی نیلوفر',
          'همکار آزمایشی آسمان',
        ];
        const employee = await service.createEmployee(
          {
            branchId: branch.id,
            personnelCode: `HR-DEMO-${branch.code}-${index + 1}`,
            name: names[index]!,
            kind: index === 2 ? 'پاره‌وقت' : 'تمام‌وقت',
            unit: 'واحد عملیات آزمایشی',
            position: index === 0 ? 'مدیر عملیات' : 'کارشناس خدمات',
            grade: index === 0 ? 'G6' : 'G4',
            ...(managerId ? { managerId } : {}),
            startedAtValue: '2026-01-01',
          },
          `${prefix}:employee:${index}`,
          actor,
        );
        if (!employee.organizationBranchId)
          await service.updateEmployee(
            employee.id,
            {
              version: employee.version,
              organizationBranchId: organizationBranches[index < 3 ? 0 : 1]!,
            },
            actor,
          );
        employees++;
        if (index === 0) managerId = employee.id;
        const organizationBranchId = organizationBranches[index < 3 ? 0 : 1]!;
        const companyName = index < 3 ? 'نیایش سیر' : 'جهان باستان';
        const companyData = { organizationBranchId };
        // Every added showcase is a draft. Replaying these stable command keys
        // preserves edits made during UAT and never approves an employment effect.
        if (index === 0 || index === 3) {
          const candidateName =
            index === 0 ? 'متقاضی آزمایشی شفق' : 'متقاضی آزمایشی پگاه';
          const applicant = await create(`showcase:applicant:${index}`, {
            section: 'recruitment',
            tab: 'applicants',
            values: [
              candidateName,
              'کارشناس خدمات آزمایشی',
              '',
              'معرفی آزمایشی داخلی',
              '',
              '2026-09-08',
              'بررسی اولیه آزمایشی',
              '',
            ],
            data: companyData,
            status: 'پیش‌نویس',
          });
          await create(`showcase:interview:${index}`, {
            section: 'recruitment',
            tab: 'interviews',
            parentId: applicant.id,
            values: [
              candidateName,
              'کارشناس خدمات آزمایشی',
              'مصاحبه اولیه',
              employee.name,
              '2026-09-15',
              '10:00',
            ],
            data: companyData,
            status: 'پیش‌نویس',
          });
          await create(`showcase:candidate-score:${index}`, {
            section: 'recruitment',
            tab: 'feedback',
            parentId: applicant.id,
            values: [
              candidateName,
              'مصاحبه اولیه',
              employee.name,
              '4',
              'تمرین نمایشی ارزیابی مهارت ارتباطی',
              'صرفاً نمونه؛ بدون تصمیم استخدام',
            ],
            data: companyData,
            status: 'پیش‌نویس',
          });
          await create(`showcase:onboarding:${index}`, {
            section: 'lifecycle',
            tab: 'onboarding',
            parentId: applicant.id,
            values: [
              candidateName,
              companyName,
              employee.unit,
              'تمام‌وقت',
              'کارشناس خدمات',
              'G4',
              employee.name,
              '2026-10-01',
            ],
            data: { ...companyData, managerId: employee.id },
            status: 'پیش‌نویس',
          });
          const cycle = await create(`showcase:appraisal-cycle:${index}`, {
            section: 'development',
            tab: 'cycles',
            values: [
              `ارزیابی پاییز آزمایشی ${companyName}`,
              '2026-09-23',
              '2026-12-21',
              'کارکنان آزمایشی شرکت',
              '2026-12-10',
              employee.name,
            ],
            data: companyData,
            status: 'پیش‌نویس',
          });
          appraisalCycleId = cycle.id;
          await create(`showcase:training:${index}`, {
            section: 'development',
            tab: 'training',
            values: [
              `کارگاه آزمایشی خدمات ${companyName}`,
              'ارتباط با مشتری',
              'مدرس آزمایشی',
              '6',
              '2026-10-10',
              '4 ساعت',
              '2026-10-10',
              'کلاس آزمایشی داخلی',
              '0',
              '—',
              'برنامه پیش‌نویس؛ هنوز برگزار نشده',
            ],
            data: companyData,
            status: 'پیش‌نویس',
          });
          await create(`showcase:vehicle:${index}`, {
            section: 'assets',
            tab: 'vehicles',
            employeeId: employee.id,
            values: [
              `خودروی آزمایشی ${companyName}`,
              'سواری نمایشی',
              '••• آزمایشی',
              companyName,
              employee.name,
              '0',
            ],
            data: companyData,
            status: 'پیش‌نویس',
          });
        }
        if (index === 1 || index === 4)
          await create(`showcase:promotion:${index}`, {
            section: 'lifecycle',
            tab: 'promotion',
            employeeId: employee.id,
            values: [
              employee.name,
              employee.position,
              employee.grade,
              'کارشناس ارشد خدمات',
              'G5',
              '2026-11-01',
              'مدیر آزمایشی',
            ],
            data: companyData,
            status: 'پیش‌نویس',
          });
        await create(`showcase:goal:${index}`, {
          section: 'development',
          tab: 'goals',
          employeeId: employee.id,
          parentId: appraisalCycleId!,
          values: [
            employee.name,
            'تکمیل تمرین کیفیت خدمات',
            'کیفیت پاسخ‌گویی',
            '100',
            '10 سناریوی آزمایشی',
            '0',
          ],
          data: companyData,
          status: 'پیش‌نویس',
        });
        await create(`showcase:equipment:${index}`, {
          section: 'assets',
          tab: 'list',
          employeeId: employee.id,
          values: [
            employee.name,
            'رایانه همراه آزمایشی',
            `DEMO-ASSET-${branch.code}-${index + 1}`,
            `FICTIONAL-SERIAL-${index + 1}`,
            '2026-10-01',
            'برنامه تحویل آزمایشی؛ تحویل نشده',
          ],
          data: companyData,
          status: 'پیش‌نویس',
        });
        const contract = await create(`contract:${index}`, {
          section: 'contracts',
          tab: 'active',
          employeeId: employee.id,
          values: [
            employee.name,
            `DEMO-${branch.code}-${index + 1}`,
            branch.name,
            'تمام‌وقت',
            '2026-01-01',
            '2026-12-31',
            employee.position,
            '540000000',
            'IRR',
            'تعهدات نمونه صرفاً برای آزمون رابط و بدون اعتبار حقوقی',
            'نمونه',
            'نمونه',
          ],
          status: 'تأییدشده',
        });
        if (contract.values[2] !== companyName) {
          if (contract.status !== 'لغوشده')
            await service.updateRecord(
              contract.id,
              {
                version: contract.version,
                status: 'لغوشده',
                data: {
                  reason:
                    'اصلاح نمونه آزمایشی صادرکننده؛ نسخه اولیه و تاریخچه حفظ می‌شود.',
                },
              },
              actor,
            );
          const companyValues = [...contract.values];
          companyValues[1] = `DEMO-COMPANY-${branch.code}-${index + 1}`;
          companyValues[2] = companyName;
          await create(`company-contract:${index}`, {
            section: 'contracts',
            tab: 'active',
            employeeId: employee.id,
            values: companyValues,
            status: 'تأییدشده',
          });
        }
        await create(`amendment:${index}`, {
          section: 'contracts',
          tab: 'amendments',
          employeeId: employee.id,
          parentId: contract.id,
          values: [
            employee.name,
            contract.code,
            'بررسی تمدید',
            '2027-01-01',
            'الحاقیه آزمایشی در انتظار بررسی',
            'v2',
          ],
          status: 'در انتظار امضا',
        });
        await create(`shift:${index}`, {
          section: 'time',
          tab: 'shift',
          employeeId: employee.id,
          values: [
            'شیفت صبح آزمایشی',
            '08:00',
            '17:00',
            '15',
            '8',
            'تقویم آزمایشی',
            employee.name,
            '2026-09-01',
            '2026-09-30',
          ],
          status: 'فعال',
        });
        for (const [kind, time, label] of [
          ['ورود', '08:10', 'in'],
          ['خروج', '17:05', 'out'],
        ] as const)
          await create(`clock:${index}:${label}`, {
            section: 'time',
            tab: 'checkins',
            employeeId: employee.id,
            values: [
              employee.name,
              '2026-09-08',
              time,
              kind,
              'ثبت دستی آزمایشی',
              branch.name,
            ],
            status: 'معتبر',
          });
        await service.grantLeave(
          {
            employeeId: employee.id,
            type: 'استحقاقی',
            days: '12',
            year: 2026,
            reason: 'سهمیه نمایشی سازمان؛ بدون ادعای قاعده قانونی',
          },
          `${prefix}:allowance:${index}`,
          actor,
        );
        await create(`leave:${index}`, {
          section: 'time',
          tab: 'leave',
          employeeId: employee.id,
          values: [
            employee.name,
            'استحقاقی',
            '2026-09-20',
            '2026-09-21',
            '2',
            'همکار آزمایشی',
          ],
          status: 'در انتظار تأیید',
        });
        const mission = await create(`mission:${index}`, {
          section: 'time',
          tab: 'mission',
          employeeId: employee.id,
          values: [
            employee.name,
            'مقصد آزمایشی',
            '2026-10-05',
            '2026-10-07',
            'جلسه آزمایشی مشتریان',
            'مدیر آزمایشی',
          ],
          status: 'در انتظار تأیید',
        });
        await create(`claim:${index}`, {
          section: 'expenses',
          tab: 'claims',
          employeeId: employee.id,
          parentId: mission.id,
          values: [
            employee.name,
            'هزینه رفت‌وآمد',
            '2026-09-08',
            'IRR',
            '1200000',
            'مرجع اسناد پس از بارگذاری',
            'در انتظار بررسی',
          ],
          data: { currency: 'IRR' },
          status: 'پیش‌نویس',
        });
      }
      await service.processAttendance(
        { branchId: branch.id, date: '2026-09-08' },
        `${prefix}:attendance:v2`,
        actor,
      );
    }
    process.stdout.write(
      JSON.stringify({
        apply: true,
        branches: branches.length,
        employees,
        records,
        fictional: true,
        existingUsersUnchanged: true,
        organization: {
          legacyRowsUpdated: legacyOrganizationRowsUpdated,
          jahanLabelsUpdated: jahanOrganizationLabelsUpdated,
          unitCounts: organizationUnitCounts,
        },
        showcase: {
          uniqueRecords: showcaseIds.size,
          resources: showcaseByResource,
          statuses: showcaseByStatus,
        },
      }) + '\n',
    );
  } finally {
    await client.$disconnect();
  }
}
void main().catch((error: unknown) => {
  process.stderr.write(
    `HR demo failed: ${error instanceof Error ? error.message : 'unknown error'}\n`,
  );
  process.exitCode = 1;
});
