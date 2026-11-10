import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import {
  createDatabaseClient,
  type DatabaseClient,
  type Prisma,
} from '@nora/database';
import type {
  AuthenticatedActor,
  InsuranceStandaloneInputV1,
} from '@nora/contracts';
import { InsuranceApplicantCrypto } from './insurance-applicant.crypto';
import { StandaloneInsuranceService } from './standalone-insurance.service';
import { ReservationInsuranceService } from './insurance.service';

describe.skipIf(process.env.INSURANCE_POLICY_TEST !== '1')(
  'standalone insurance through real Prisma/PostgreSQL transactions',
  () => {
    let admin: DatabaseClient, db: DatabaseClient;
    const databaseName = 'insurance_proof_' + randomUUID().replace(/-/g, '');
    const actorId = randomUUID(),
      branchId = randomUUID();
    beforeAll(async () => {
      const base = new URL(process.env.DATABASE_URL!);
      if (
        base.hostname !== '127.0.0.1' ||
        !['/nora_ci', '/insurance_test'].includes(base.pathname)
      )
        throw new Error('Disposable insurance test database required');
      admin = createDatabaseClient(base.toString());
      await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
      base.pathname = '/' + databaseName;
      db = createDatabaseClient(base.toString());
      for (const table of [
        'branches',
        'iam_users',
        'customers',
        'sales_contracts',
        'ReservationIntake',
      ])
        await db.$executeRawUnsafe(
          `CREATE TABLE "${table}" (id uuid PRIMARY KEY)`,
        );
      await db.$executeRawUnsafe(
        'ALTER TABLE "ReservationIntake" ADD COLUMN "branchId" uuid, ADD COLUMN snapshot jsonb',
      );
      for (const migration of [
        '20261025180000_reservation_insurance_policies',
        '20261107110000_insurance_automation',
        '20261109100000_standalone_insurance_applicants',
      ]) {
        const sql = readFileSync(
          resolve(
            __dirname,
            '../../../../../packages/database/prisma/migrations',
            migration,
            'migration.sql',
          ),
          'utf8',
        );
        for (const statement of sql
          .replace(/^--.*$/gm, '')
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean))
          await db.$executeRawUnsafe(statement);
      }
      await db.$executeRaw`INSERT INTO branches (id) VALUES (${branchId}::uuid)`;
      await db.$executeRaw`INSERT INTO iam_users (id) VALUES (${actorId}::uuid)`;
    }, 30000);
    afterAll(async () => {
      await db?.$disconnect();
      if (admin) {
        try {
          await admin.$executeRawUnsafe(
            `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`,
          );
        } finally {
          await admin.$disconnect();
        }
      }
    });
    it('creates no contract/customer, replays safely, audits reads, enforces CAS/branches and rolls back a mid-save failure', async () => {
      const actor = {
        userId: actorId,
        branchIds: [branchId],
        permissions: [
          'reservations.read',
          'customers.read',
          'reservations.documents.manage',
        ],
      } as AuthenticatedActor;
      const input: InsuranceStandaloneInputV1 = {
        requestKey: randomUUID(),
        branchId,
        sourceCountryCode: '1',
        destinationCode: '5',
        planCode: '76',
        departureDate: '2027-01-01',
        durationDays: 7,
        notes: '',
        expectedVersion: 0,
        passenger: {
          version: 1,
          firstName: 'Synthetic',
          lastName: 'Applicant',
          firstNameLatin: 'SYNTHETIC',
          lastNameLatin: 'APPLICANT',
          nationalityCode: 'TUR',
          nationalCode: '',
          passportNo: 'SYNTHETIC123',
          birthDate: '1990-01-01',
          gender: 'F',
          mobile: '00000000000',
          email: 'synthetic@example.invalid',
        },
      };
      const settings = {
        read: vi.fn(async () => ({
          config: {
            countries: [
              {
                active: true,
                providerCountryCode: '5',
                plans: [{ providerPlanCode: '76' }],
              },
            ],
          },
        })),
        issuanceCatalog: vi.fn(async () => ({
          countries: [{ id: 1 }],
          plans: [{ id: 76 }],
          durations: [{ days: 2 }, { days: 7 }],
        })),
      };
      const provider = {
        policyPdf: vi.fn(async () => Buffer.from('%PDF-synthetic')),
      };
      const crypto = new InsuranceApplicantCrypto(
        new ConfigService({
          CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 8).toString(
            'base64',
          ),
          CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64: Buffer.alloc(32, 9).toString(
            'base64',
          ),
          CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION: 1,
        }),
      );
      const service = new StandaloneInsuranceService(
        { client: db } as never,
        settings as never,
        crypto,
        provider as never,
        { validateApplicant: vi.fn() } as never,
      );
      const replies = await Promise.all([
        service.save(input, actor),
        service.save(input, actor),
      ]);
      const id = replies[0]!.data.id;
      expect(replies[1]!.data.id).toBe(id);
      expect(await db.reservationInsurancePolicy.count()).toBe(1);
      expect(await db.reservationInsuranceApplicant.count()).toBe(1);
      expect(
        (
          await db.$queryRaw<
            { count: bigint }[]
          >`SELECT count(*) FROM sales_contracts`
        )[0]?.count,
      ).toBe(0n);
      expect(
        (
          await db.$queryRaw<
            { count: bigint }[]
          >`SELECT count(*) FROM customers`
        )[0]?.count,
      ).toBe(0n);
      const row = await db.reservationInsurancePolicy.findUniqueOrThrow({
        where: { id },
        include: { applicant: true },
      });
      expect(row).toMatchObject({
        contractId: null,
        intakeId: null,
        customerId: null,
        automatic: true,
        sandbox: true,
      });
      expect(row.applicant?.encryptedData).not.toContain(input.passenger.email);
      expect(row.applicant?.encryptedData).not.toContain(
        input.passenger.passportNo,
      );
      const customers = { detail: vi.fn() };
      const policies = new ReservationInsuranceService(
        { client: db } as never,
        {} as never,
        customers as never,
        settings as never,
        {} as never,
      );
      expect((await policies.list({}, actor)).data).toMatchObject([
        {
          id,
          standalone: true,
          branchId,
          customerId: null,
          intakeId: null,
          contractNumber: '',
        },
      ]);
      expect(customers.detail).not.toHaveBeenCalled();
      expect(
        (
          await policies.list(
            { search: 'SYNTHETIC' },
            { ...actor, branchIds: [randomUUID()] },
          )
        ).count,
      ).toBe(0);
      await expect(
        service.save(
          {
            ...input,
            passenger: { ...input.passenger, email: 'changed@example.invalid' },
          },
          actor,
        ),
      ).rejects.toThrow('قبلاً');
      await expect(
        service.save(input, { ...actor, permissions: [] }),
      ).rejects.toThrow();
      await expect(
        service.save(
          { ...input, requestKey: randomUUID(), durationDays: 1 },
          actor,
        ),
      ).rejects.toThrow('مدت بیمه');
      const other = { ...actor, branchIds: [randomUUID()] };
      await expect(service.read(id, other)).rejects.toThrow();
      expect(await db.reservationInsuranceApplicantAccess.count()).toBe(0);
      expect((await service.read(id, actor)).data.passenger.email).toBe(
        input.passenger.email,
      );
      expect(await db.reservationInsuranceApplicantAccess.count()).toBe(1);
      await expect(service.pdf(id, actor)).rejects.toThrow();
      expect(provider.policyPdf).not.toHaveBeenCalled();
      const correction = {
        ...input,
        expectedVersion: 1,
        passenger: { ...input.passenger, email: 'corrected@example.invalid' },
      };
      const originalError = 'ثبت درخواست بیمه: اطلاعات پذیرفته نشد (کد 400).';
      await db.reservationInsurancePolicy.update({
        where: { id },
        data: {
          lastError: originalError,
          automation: { phase: 'QUEUED', firstError: originalError },
        },
      });
      await service.save(correction, actor, id);
      expect((await service.read(id, actor)).data).toMatchObject({
        expectedVersion: 2,
        passenger: { email: 'corrected@example.invalid' },
      });
      await expect(service.save(correction, actor, id)).rejects.toThrow(
        'تغییر',
      );
      expect(
        JSON.stringify(await db.reservationInsuranceRevision.findMany()),
      ).not.toContain('corrected@example.invalid');
      expect((await policies.history(id, actor)).data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            snapshot: expect.objectContaining({ previousError: originalError }),
          }),
        ]),
      );
      await db.reservationInsurancePolicy.update({
        where: { id },
        data: {
          automation: { phase: 'CREATING', fingerprint: 'synthetic-submitted' },
        },
      });
      await expect(
        service.save({ ...correction, expectedVersion: 2 }, actor, id),
      ).rejects.toThrow('در حال بررسی');
      // Force a failure after applicant/policy writes, proving the real transaction
      // removes both rather than leaving an orphan applicant or an untracked policy.
      await db.$executeRawUnsafe(
        "ALTER TABLE reservation_insurance_revisions ADD CONSTRAINT insurance_proof_revision_failure CHECK (action <> 'STANDALONE_CREATED') NOT VALID",
      );
      try {
        await expect(
          service.save({ ...input, requestKey: randomUUID() }, actor),
        ).rejects.toThrow();
        expect(await db.reservationInsuranceApplicant.count()).toBe(1);
        expect(await db.reservationInsurancePolicy.count()).toBe(1);
      } finally {
        await db.$executeRawUnsafe(
          'ALTER TABLE reservation_insurance_revisions DROP CONSTRAINT insurance_proof_revision_failure',
        );
      }
      const active: Prisma.ReservationInsurancePolicyUpdateInput = {
        status: 'ISSUED',
        providerId: 'synthetic-provider',
        policyNumber: 'SYNTHETIC-POLICY',
        amount: '123.45',
        currencyCode: 'IRR',
        issuedAt: new Date(),
        automation: { phase: 'ISSUED' },
        pdfUrl:
          'https://sandbox.travis.ir/Print/PolicyPdf/11111111-1111-4111-8111-111111111111/true',
      };
      await db.reservationInsurancePolicy.update({
        where: { id },
        data: active,
      });
      await expect(service.pdf(id, other)).rejects.toThrow();
      expect((await service.pdf(id, actor)).bytes.toString()).toBe(
        '%PDF-synthetic',
      );
      expect(provider.policyPdf).toHaveBeenCalledTimes(1);
    }, 30000);
  },
);
