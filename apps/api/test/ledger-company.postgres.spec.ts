import { MasterDataService } from '../src/master-data/master-data.service';
import { MasterDataRepository } from '../src/master-data/master-data.repository';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { createDatabaseClient } from '@nora/database';
import type { AuthenticatedActor, LedgerCompanyInput } from '@nora/contracts';
import { it, expect, describe } from 'vitest';
import { CustomerService } from '../src/customers/customer.service';
import { CustomerRepository } from '../src/customers/customer.repository';
import { CustomerContactCrypto } from '../src/customers/customer-contact.crypto';
import { CustomerNationalIdProtector } from '../src/customers/customer-national-id';

const url = process.env.LEDGER_COMPANY_TEST_DATABASE_URL;
describe.skipIf(!url)('ledger company on PostgreSQL', () => {
  it('saves a company, preserves its organization FK, and rolls both records back on failure', async () => {
    const dest = new URL(url!);
    if (
      dest.hostname !== '127.0.0.1' ||
      dest.port !== '55495' ||
      dest.pathname !== '/accounting_company_qa'
    )
      throw Error('Disposable accounting database required');
    const db = createDatabaseClient(url);
    const branch = randomUUID(),
      other = randomUUID(),
      userId = randomUUID();
    try {
      await db.branch.createMany({
        data: [branch, other].map((id) => ({
          id,
          code: id,
          name: 'Synthetic test',
        })),
      });
      await db.user.create({
        data: {
          id: userId,
          username: userId,
          displayName: 'Ledger tester',
          passwordHash: 'disabled',
        },
      });
      const actor: AuthenticatedActor = {
        userId,
        sessionId: randomUUID(),
        permissions: [
          'finance.read',
          'finance.account.manage',
          'customers.create',
          'customers.read',
          'customers.update',
          'customers.sensitive.read',
          'master_data.create',
          'master_data.update',
        ],
        branchIds: [branch, other],
      };
      const config = new ConfigService({
        CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 1).toString(
          'base64',
        ),
        CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64: Buffer.alloc(32, 2).toString(
          'base64',
        ),
        CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION: 1,
      });
      const repo = new CustomerRepository({ client: db } as never);
      const svc = new CustomerService(
        repo,
        new CustomerContactCrypto(config),
        new CustomerNationalIdProtector(config),
        undefined,
        new MasterDataService(
          new MasterDataRepository({ client: db } as never),
        ),
      );
      const nationalId = (Date.now() % 100000000000)
        .toString()
        .padStart(11, '0');
      const input: LedgerCompanyInput = {
        code: '۰۰۰۲۵',
        name: 'Synthetic Co ' + branch,
        nationalId,
        economicCode: '',
        registrationNumber: '',
        fields: {
          companyType: 'وزارتخانه',
          abbreviation: 'SC',
          workflowCode: 'W25',
        },
        addresses: [
          {
            id: randomUUID(),
            primary: true,
            title: 'office',
            address: 'Example address',
            region: 'Area',
            fax: '',
            phone: '',
            email: '',
            postalCode: '',
          },
        ],
        notes: [
          {
            id: randomUUID(),
            title: 'Memo',
            text: 'Internal',
            date: '2026-11-04',
          },
        ],
        taxRows: [{ operation: 'sale', kind: 'registered' }],
      };
      const { data: created } = await svc.saveLedgerCompany(
        input,
        branch,
        actor,
      );
      const stored = await db.customer.findUniqueOrThrow({
        where: { id: created.id },
      });
      expect(stored.ledgerCompanyCode).toBe('00025');
      expect(stored.ledgerCompanyEnvelope).not.toContain('وزارتخانه');
      expect(stored.organizationId).toBeTruthy();
      const { data: read } = await svc.ledgerCompany(created.id, branch, actor);
      expect(read).toMatchObject({
        code: '00025',
        name: input.name,
        nationalId,
        fields: input.fields,
        taxRows: input.taxRows,
        addresses: input.addresses,
        notes: [{ title: 'Memo', createdBy: userId }],
      });
      await expect(
        svc.ledgerCompany(created.id, other, actor),
      ).rejects.toThrow();
      await expect(
        svc.ledgerCompany(created.id, branch, { ...actor, permissions: [] }),
      ).rejects.toThrow();
      await expect(
        svc.saveLedgerCompany(
          { ...input, fields: { companyType: 'unknown' } },
          branch,
          actor,
        ),
      ).rejects.toThrow();
      await expect(
        svc.saveLedgerCompany(
          { ...input, taxRows: [{ operation: 'sale', kind: 'consumer' }] },
          branch,
          actor,
        ),
      ).rejects.toThrow();
      await expect(
        svc.saveLedgerCompany({ ...input, nationalId: '123' }, branch, actor),
      ).rejects.toThrow();
      const duplicateName = 'No orphan ' + branch;
      await expect(
        svc.saveLedgerCompany(
          { ...input, nationalId: '', name: duplicateName },
          branch,
          actor,
        ),
      ).rejects.toThrow();
      expect(
        await db.masterOrganization.count({
          where: { legalName: duplicateName },
        }),
      ).toBe(0);
      const nextName = 'Updated ' + branch;
      await svc.saveLedgerCompany(
        {
          ...read,
          name: nextName,
          fields: { ...read.fields, companyType: 'تضامنی' },
        },
        branch,
        actor,
        created.id,
      );
      const current = await svc.ledgerCompany(created.id, branch, actor);
      expect(current.data.name).toBe(nextName);
      expect(current.data.fields.companyType).toBe('تضامنی');
      await expect(
        svc.saveLedgerCompany(read, branch, actor, created.id),
      ).rejects.toThrow();
      expect(
        await repo.selectionOptions([branch], {
          search: nextName,
          kind: 'organization',
          page: 1,
          pageSize: 10,
        }),
      ).toEqual([
        { id: created.id, displayName: nextName, companyCode: '00025' },
      ]);
    } finally {
      await db.$disconnect();
    }
  }, 30000);
});
