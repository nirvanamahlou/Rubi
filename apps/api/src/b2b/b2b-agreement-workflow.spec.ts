import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';
import { b2bAgreementTermsIssue } from '@nora/contracts';
import type { AuthenticatedActor } from '@nora/contracts';
import { SaveB2bAgreementDto } from './b2b-agreement-workflow.dto';
import { agreementTestTerms } from './agreement-test-fixtures';
import { B2bAgreementWorkflowService } from './b2b-agreement-workflow.service';
import type { B2bAgreementWorkflowRepository } from './b2b-agreement-workflow.repository';
import type { MasterOrganizationDirectory } from '../master-data/master-organization-directory';
import type { B2bAgreementDocuments } from './b2b-agreement-documents';

const id = '11111111-1111-4111-8111-111111111111';
const input = () => ({
  branchId: id,
  role: 'CORPORATE_CUSTOMER' as const,
  requestId: id,
  terms: agreementTestTerms(),
});
const actor: AuthenticatedActor = {
  userId: id,
  sessionId: id,
  branchIds: [id],
  permissions: [
    'b2b.agreement.read',
    'b2b.credit.read',
    'b2b.agreement.manage',
  ],
};
describe('agreement terms and public boundary checks', () => {
  it('accepts two independent decimal currency limits without converting through Number', () => {
    expect(b2bAgreementTermsIssue(agreementTestTerms())).toBeUndefined();
    expect(
      validateSync(plainToInstance(SaveB2bAgreementDto, input()), {
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    ).toEqual([]);
  });
  it('accepts an omitted registration explanation as an empty optional value', () => {
    const terms = { ...agreementTestTerms(), changeReason: '' };
    expect(b2bAgreementTermsIssue(terms)).toBeUndefined();
    expect(
      validateSync(
        plainToInstance(SaveB2bAgreementDto, { ...input(), terms }),
        { whitelist: true, forbidNonWhitelisted: true },
      ),
    ).toEqual([]);
  });
  it('rejects duplicate transient grants without including token text in validation messages', () => {
    const token = 'super-secret-token-value';
    const errors = validateSync(
      plainToInstance(SaveB2bAgreementDto, {
        ...input(),
        referenceGrants: [
          { documentId: id, token },
          { documentId: id, token: `${token}-other` },
        ],
      }),
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(
      JSON.stringify(errors.map((error) => error.constraints)),
    ).not.toContain(token);
  });
  it.each([undefined, null, {}, []])(
    'rejects missing or malformed terms %s',
    (terms) => {
      expect(
        validateSync(
          plainToInstance(SaveB2bAgreementDto, { ...input(), terms }),
          { whitelist: true, forbidNonWhitelisted: true },
        ).length,
      ).toBeGreaterThan(0);
    },
  );
  it('rejects forbidden review state in a draft DTO and numeric money', () => {
    expect(
      validateSync(
        plainToInstance(SaveB2bAgreementDto, {
          ...input(),
          terms: { ...agreementTestTerms(), status: 'APPROVED' },
        }),
        { whitelist: true, forbidNonWhitelisted: true },
      ),
    ).not.toEqual([]);
    const terms = agreementTestTerms();
    terms.creditPolicies[0]!.creditLimit = 100 as unknown as string;
    expect(
      validateSync(plainToInstance(SaveB2bAgreementDto, { ...input(), terms })),
    ).not.toEqual([]);
  });
  it('rejects invalid dates, duplicate currencies, policy dates outside contract, and received deposits', () => {
    const terms = agreementTestTerms();
    expect(
      b2bAgreementTermsIssue({ ...terms, startsAt: '2026-02-30' }),
    ).toContain('بازه');
    expect(
      b2bAgreementTermsIssue({
        ...terms,
        creditPolicies: [terms.creditPolicies[0]!, terms.creditPolicies[0]!],
      }),
    ).toContain('تنها یک');
    expect(
      b2bAgreementTermsIssue({
        ...terms,
        creditPolicies: [{ ...terms.creditPolicies[0]!, expiresAt: null }],
      }),
    ).toContain('بازه');
    expect(
      b2bAgreementTermsIssue({
        ...terms,
        guarantees: [
          { ...terms.guarantees[0]!, status: 'RECEIVED', documentId: id },
        ],
      }),
    ).toContain('مالی');
  });
  function setup() {
    const repository = {
      save: vi.fn(async (_command, _terms, prepare) => {
        await prepare(null);
        throw new Error('persistence reached');
      }),
      list: vi.fn(),
    };
    const organizations = {
      cooperationReference: vi.fn().mockResolvedValue({ id, isActive: true }),
      activeCurrencyCodes: vi.fn().mockResolvedValue(['IRR', 'USD']),
      activePaymentMethod: vi
        .fn()
        .mockResolvedValue({ id, name: 'انتقال بانکی' }),
    };
    const documents = {
      assertDraftReference: vi
        .fn()
        .mockResolvedValue({ documentId: id, versionId: id }),
    };
    return {
      repository,
      organizations,
      documents,
      service: new B2bAgreementWorkflowService(
        repository as unknown as B2bAgreementWorkflowRepository,
        organizations as unknown as MasterOrganizationDirectory,
        documents as unknown as B2bAgreementDocuments,
      ),
    };
  }
  it('requires credit management for a bundle containing limits and checks branch scope', async () => {
    const { service, organizations, repository } = setup();
    await expect(service.save(id, undefined, input(), actor)).rejects.toThrow(
      'مجوز',
    );
    expect(organizations.cooperationReference).not.toHaveBeenCalled();
    await expect(service.list(id, 'outside', 'AGENCY', actor)).rejects.toThrow(
      'دامنه',
    );
    expect(repository.list).not.toHaveBeenCalled();
  });
  it('resolves corporate identity and active currency codes through the Master Data public service', async () => {
    const { service, organizations } = setup();
    await expect(
      service.save(id, undefined, input(), {
        ...actor,
        permissions: [...actor.permissions, 'b2b.credit.manage'],
      }),
    ).rejects.toThrow('persistence reached');
    expect(organizations.cooperationReference).toHaveBeenCalledWith(
      id,
      'CORPORATE_CUSTOMER',
    );
    organizations.activeCurrencyCodes.mockResolvedValue(['IRR']);
    await expect(
      service.save(id, undefined, input(), {
        ...actor,
        permissions: [...actor.permissions, 'b2b.credit.manage'],
      }),
    ).rejects.toThrow('ارز');
  });
  it('rejects stale document versions and delegates exact ownership checks to Documents', async () => {
    const { service, documents } = setup();
    const dto = input();
    dto.terms.documentId = id;
    dto.terms.documentVersionId = '22222222-2222-4222-8222-222222222222';
    await expect(
      service.save(id, undefined, dto, {
        ...actor,
        permissions: [...actor.permissions, 'b2b.credit.manage'],
      }),
    ).rejects.toThrow('نسخه سند');
    expect(documents.assertDraftReference).toHaveBeenCalledWith(
      id,
      id,
      id,
      expect.objectContaining({ userId: id }),
      true,
      '22222222-2222-4222-8222-222222222222',
      undefined,
    );
  });
  it('keeps renewed grants out of persisted terms and semantic commands', async () => {
    const { service, documents, repository } = setup();
    const writer = {
      ...actor,
      permissions: [
        ...actor.permissions,
        'b2b.credit.manage',
      ] as typeof actor.permissions,
    };
    for (const token of ['a'.repeat(32), 'b'.repeat(32)]) {
      const dto = input();
      dto.terms.documentId = id;
      await expect(
        service.save(
          id,
          undefined,
          { ...dto, referenceGrants: [{ documentId: id, token }] },
          writer,
        ),
      ).rejects.toThrow('persistence reached');
    }
    expect(repository.save).toHaveBeenCalledTimes(2);
    expect(repository.save.mock.calls[0]?.[0]).toEqual(
      repository.save.mock.calls[1]?.[0],
    );
    expect(repository.save.mock.calls[0]?.[1]).toEqual(
      repository.save.mock.calls[1]?.[1],
    );
    const persisted = JSON.stringify(
      repository.save.mock.calls.map(([command, terms]) => [command, terms]),
    );
    expect(persisted).not.toContain('a'.repeat(32));
    expect(persisted).not.toContain('b'.repeat(32));
    expect(documents.assertDraftReference).toHaveBeenNthCalledWith(
      1,
      id,
      id,
      id,
      writer,
      true,
      undefined,
      'a'.repeat(32),
    );
    expect(documents.assertDraftReference).toHaveBeenNthCalledWith(
      2,
      id,
      id,
      id,
      writer,
      true,
      undefined,
      'b'.repeat(32),
    );
  });
  it('rejects grants unrelated to the contract before persistence', async () => {
    const { service, repository } = setup();
    await expect(
      service.save(
        id,
        undefined,
        {
          ...input(),
          referenceGrants: [
            {
              documentId: '22222222-2222-4222-8222-222222222222',
              token: 'x'.repeat(32),
            },
          ],
        },
        {
          ...actor,
          permissions: [...actor.permissions, 'b2b.credit.manage'],
        },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'B2B_DOCUMENT_GRANT_UNRELATED',
      }),
    });
    expect(repository.save).not.toHaveBeenCalled();
  });
  it('validates the payment method through Master Data and rejects inactive references', async () => {
    const { service, organizations } = setup();
    const dto = input();
    dto.terms.paymentMethodId = id;
    dto.terms.agreementType = 'HOTEL_SERVICES';
    const writer = {
      ...actor,
      permissions: [
        ...actor.permissions,
        'b2b.credit.manage',
      ] as typeof actor.permissions,
    };
    await expect(service.save(id, undefined, dto, writer)).rejects.toThrow(
      'persistence reached',
    );
    expect(organizations.activePaymentMethod).toHaveBeenCalledWith(id);
    organizations.activePaymentMethod.mockResolvedValue(null as never);
    await expect(service.save(id, undefined, dto, writer)).rejects.toThrow(
      'روش پرداخت',
    );
  });
});
