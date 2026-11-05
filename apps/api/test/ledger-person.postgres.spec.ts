import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { createDatabaseClient } from '@nora/database';
import type { AuthenticatedActor, LedgerPersonInput } from '@nora/contracts';
import { it, expect, describe } from 'vitest';
import { CustomerService } from '../src/customers/customer.service';
import { CustomerRepository } from '../src/customers/customer.repository';
import { CustomerContactCrypto } from '../src/customers/customer-contact.crypto';
import { CustomerNationalIdProtector } from '../src/customers/customer-national-id';

const url = process.env.LEDGER_PERSON_TEST_DATABASE_URL;
describe.skipIf(!url)('ledger person on PostgreSQL', () => {
  it('commits one protected person with typed child rows, enforces branch, version and identity on edit', async () => {
    const dest = new URL(url!);
    if (
      dest.hostname !== '127.0.0.1' ||
      dest.port !== '55494' ||
      dest.pathname !== '/accounting_design_qa'
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
      );
      const noteId = randomUUID();
      const input: LedgerPersonInput = {
        code: '۰۰۰۷',
        firstName: 'Test',
        lastName: 'Person',
        gender: 'F',
        birthDate: '',
        fields: { workflowCode: 'WX', email: 'test@example.invalid' },
        addresses: [
          {
            id: randomUUID(),
            title: 'Office',
            region: 'Sample',
            address: 'Private address',
            primary: true,
            phone: '',
            fax: '',
            postalCode: '',
            email: '',
          },
        ],
        taxRows: [{ operation: 'sale', kind: 'consumer' }],
        notes: [
          {
            id: noteId,
            title: 'Memo',
            date: '2026-01-02',
            text: 'Private note',
            createdBy: 'forged',
          },
        ],
      };
      const results = await Promise.allSettled([
        svc.saveLedgerPerson(input, branch, actor),
        svc.saveLedgerPerson(input, branch, actor),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const stored = await db.customer.findFirstOrThrow({
        where: { ownerBranchId: branch, ledgerPersonCode: '0007' },
      });
      expect(stored.nationalIdEncrypted).toBeNull();
      expect(stored.ledgerPersonEnvelope).not.toContain('Private');
      const { data } = await svc.ledgerPerson(stored.id, branch, actor);
      expect(data).toMatchObject({
        code: '0007',
        firstName: 'Test',
        fields: { workflowCode: 'WX' },
        addresses: input.addresses,
        taxRows: input.taxRows,
        notes: [{ id: noteId, createdBy: userId, text: 'Private note' }],
      });
      await expect(svc.ledgerPerson(stored.id, other, actor)).rejects.toThrow();
      await expect(
        svc.ledgerPerson(stored.id, branch, { ...actor, permissions: [] }),
      ).rejects.toThrow();
      await expect(
        svc.saveLedgerPerson(
          { ...input, taxRows: [{ operation: 'purchase', kind: 'consumer' }] },
          other,
          actor,
        ),
      ).rejects.toThrow();
      await expect(
        svc.saveLedgerPerson({ ...input, gender: '' }, other, actor),
      ).rejects.toThrow();
      await expect(
        svc.saveLedgerPerson(
          { ...input, nationalId: '1111111111' },
          other,
          actor,
        ),
      ).rejects.toThrow();
      const saved = await svc.saveLedgerPerson(
        {
          ...input,
          lastName: 'Edited',
          version: data.version,
          fields: { ...input.fields, workflowCode: 'WX2' },
        },
        branch,
        actor,
        stored.id,
      );
      expect(saved.data.displayName).toBe('Test Edited');
      await expect(
        svc.saveLedgerPerson(
          { ...input, version: data.version },
          branch,
          actor,
          stored.id,
        ),
      ).rejects.toThrow();
      expect(
        (await svc.ledgerPerson(stored.id, branch, actor)).data.fields
          .workflowCode,
      ).toBe('WX2');
      expect(
        await repo.selectionOptions([branch], {
          search: 'Edited',
          kind: 'person',
          page: 1,
          pageSize: 10,
        }),
      ).toEqual([
        { id: stored.id, displayName: 'Test Edited', personCode: '0007' },
      ]);
    } finally {
      await db.$disconnect();
    }
  }, 30000);
});
