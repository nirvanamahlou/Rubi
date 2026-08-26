import { HttpException, UnprocessableEntityException } from '@nestjs/common';
import {
  LegalEntityContextMode,
  LegalEntityDocumentIssueStatus,
} from '@rubi/database';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@rubi/contracts';

import type { DatabaseService } from '../database/database.service';
import type {
  DocumentTemplatePolicyPort,
  ResolvedDocumentTemplatePolicy,
} from './document-template-policy.port';
import { LegalEntitiesService } from './legal-entities.service';

const actor: AuthenticatedActor = {
  userId: '00000000-0000-4000-8000-000000000001',
  sessionId: 'session-1',
  permissions: [
    'legal-entity.read',
    'legal-entity.switch',
    'legal-entity.document.issue',
    'legal-entity.document.reissue',
    'legal-entity.aggregate.read',
  ],
  branchIds: ['branch-1'],
};

const issuer = {
  id: '00000000-0000-4000-8000-000000000010',
  code: 'NIYAYESH_SEIR_SAHAR',
  persianName: 'نیایش سیر سحر',
  latinName: null,
  tradeName: null,
  logoFileId: null,
  letterheadFileId: '00000000-0000-4000-8000-000000000020',
  footerFileId: null,
  address: null,
  phone: null,
  email: null,
  website: null,
  nationalId: null,
  registrationNumber: null,
  economicCode: null,
  paymentText: null,
  sealFileId: null,
  authorizedSignatureId: null,
  primaryColor: null,
  secondaryColor: null,
  legalFooterText: null,
  isActive: true,
  version: 1,
  brandingSnapshotVersion: 3,
  updatedAt: new Date('2026-08-25T00:00:00Z'),
};

const policy: ResolvedDocumentTemplatePolicy = {
  documentType: 'INVOICE',
  templateId: 'invoice-standard',
  templateVersion: '2',
  policyId: 'documents.invoice.official',
  policyVersion: '5',
  requiresLetterhead: true,
};

const original = {
  id: '00000000-0000-4000-8000-000000000030',
  issuerLegalEntityId: issuer.id,
  issuerCode: issuer.code,
  issuerName: issuer.persianName,
  brandingSnapshotId: '00000000-0000-4000-8000-000000000040',
  brandingSnapshotVersion: 2,
  brandingSnapshot: {},
  templateId: policy.templateId,
  templateVersion: policy.templateVersion,
  templatePolicyId: policy.policyId,
  templatePolicyVersion: '4',
  actorUserId: actor.userId,
  issuedAt: new Date('2026-08-25T00:00:00Z'),
  documentType: policy.documentType,
  referenceEntityType: 'reservation',
  referenceEntityId: 'reservation-1',
  fileHash: null,
  status: LegalEntityDocumentIssueStatus.ISSUED,
  reissueReason: null,
  originalIssueId: null,
};

function harness(options?: {
  contextMode?: LegalEntityContextMode;
  issuerLetterhead?: string | null;
  resolvedPolicy?: ResolvedDocumentTemplatePolicy | null;
  auditFails?: boolean;
  issueFails?: boolean;
}) {
  const actualIssuer = {
    ...issuer,
    letterheadFileId:
      options?.issuerLetterhead === undefined
        ? issuer.letterheadFileId
        : options.issuerLetterhead,
  };
  const created: Array<Record<string, unknown>> = [];
  const audits: Array<Record<string, unknown>> = [];
  const resolve = vi
    .fn<DocumentTemplatePolicyPort['resolve']>()
    .mockResolvedValue(
      options?.resolvedPolicy === undefined ? policy : options.resolvedPolicy,
    );
  const policies: DocumentTemplatePolicyPort = { resolve };
  const transaction = {
    legalEntityBrandingVersion: {
      findUnique: vi.fn().mockResolvedValue({
        id: '00000000-0000-4000-8000-000000000041',
        legalEntityId: issuer.id,
        version: issuer.brandingSnapshotVersion,
        snapshot: { legalEntityId: issuer.id, version: 3 },
        createdByUserId: actor.userId,
        createdAt: new Date(),
      }),
    },
    legalEntityDocumentIssue: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (options?.issueFails) throw new Error('issue failed');
        created.push(data);
        return {
          ...data,
          id: '00000000-0000-4000-8000-000000000050',
          issuedAt: new Date('2026-08-25T01:00:00Z'),
        };
      }),
    },
    legalEntityAuditEvent: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (options?.auditFails) throw new Error('audit failed');
        audits.push(data);
        return { id: 'audit-1' };
      }),
    },
  };
  const client = {
    legalEntity: { findFirst: vi.fn().mockResolvedValue(actualIssuer) },
    userLegalEntityContext: {
      findUnique: vi.fn().mockResolvedValue({
        userId: actor.userId,
        mode: options?.contextMode ?? LegalEntityContextMode.SPECIFIC,
        legalEntityId:
          (options?.contextMode ?? LegalEntityContextMode.SPECIFIC) ===
          LegalEntityContextMode.ALL
            ? null
            : issuer.id,
        version: 1,
        updatedAt: new Date(),
        legalEntity:
          (options?.contextMode ?? LegalEntityContextMode.SPECIFIC) ===
          LegalEntityContextMode.ALL
            ? null
            : actualIssuer,
      }),
    },
    legalEntityDocumentIssue: {
      findUnique: vi.fn().mockResolvedValue(original),
    },
    $transaction: async <T>(
      callback: (value: typeof transaction) => Promise<T>,
    ): Promise<T> => {
      const createdBefore = created.length;
      const auditsBefore = audits.length;
      try {
        return await callback(transaction);
      } catch (error) {
        created.splice(createdBefore);
        audits.splice(auditsBefore);
        throw error;
      }
    },
  };
  return {
    service: new LegalEntitiesService(
      { client } as unknown as DatabaseService,
      policies,
    ),
    resolve,
    created,
    audits,
  };
}

async function expectCode(promise: Promise<unknown>, code: string) {
  try {
    await promise;
    throw new Error('expected rejection');
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getResponse()).toMatchObject({ code });
  }
}

describe('trusted document issue and reissue policy', () => {
  it('fails closed for an unknown template policy', async () => {
    const test = harness({ resolvedPolicy: null });
    await expectCode(
      test.service.recordIssue(
        {
          issuerLegalEntityId: issuer.id,
          documentType: policy.documentType,
          templateId: policy.templateId,
          templateVersion: policy.templateVersion,
          referenceEntityType: 'reservation',
          referenceEntityId: 'reservation-1',
        },
        actor,
      ),
      'DOCUMENT_TEMPLATE_POLICY_NOT_FOUND',
    );
    expect(test.created).toHaveLength(0);
  });

  it('uses only trusted policy metadata and the exact branding row', async () => {
    const test = harness();
    const result = await test.service.recordIssue(
      {
        issuerLegalEntityId: issuer.id,
        documentType: policy.documentType,
        templateId: policy.templateId,
        templateVersion: policy.templateVersion,
        referenceEntityType: 'reservation',
        referenceEntityId: 'reservation-1',
      },
      actor,
    );
    expect(result.data).toMatchObject({
      brandingSnapshotId: '00000000-0000-4000-8000-000000000041',
      brandingSnapshotVersion: 3,
      templatePolicyId: policy.policyId,
      templatePolicyVersion: policy.policyVersion,
    });
    expect(test.created[0]).toMatchObject({
      brandingSnapshotId: '00000000-0000-4000-8000-000000000041',
      templatePolicyId: policy.policyId,
    });
    expect(test.audits).toHaveLength(1);
  });

  it('rejects official output without letterhead and rejects ALL for issue', async () => {
    await expectCode(
      harness({ issuerLetterhead: null }).service.recordIssue(
        {
          issuerLegalEntityId: issuer.id,
          documentType: policy.documentType,
          templateId: policy.templateId,
          templateVersion: policy.templateVersion,
          referenceEntityType: 'reservation',
          referenceEntityId: 'reservation-1',
        },
        actor,
      ),
      'LEGAL_ENTITY_LETTERHEAD_REQUIRED',
    );
    await expect(
      harness({ contextMode: LegalEntityContextMode.ALL }).service.recordIssue(
        {
          issuerLegalEntityId: issuer.id,
          documentType: policy.documentType,
          templateId: policy.templateId,
          templateVersion: policy.templateVersion,
          referenceEntityType: 'reservation',
          referenceEntityId: 'reservation-1',
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects reissue without trusted letterhead and in ALL context', async () => {
    await expectCode(
      harness({ issuerLetterhead: null }).service.reissue(
        { originalIssueId: original.id, reason: 'اصلاح معتبر' },
        actor,
      ),
      'LEGAL_ENTITY_LETTERHEAD_REQUIRED',
    );
    await expect(
      harness({ contextMode: LegalEntityContextMode.ALL }).service.reissue(
        { originalIssueId: original.id, reason: 'اصلاح معتبر' },
        actor,
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('does not leave a successful audit when reissue creation fails', async () => {
    const test = harness({ issueFails: true });
    await expect(
      test.service.reissue(
        { originalIssueId: original.id, reason: 'اصلاح معتبر' },
        actor,
      ),
    ).rejects.toThrow('issue failed');
    expect(test.created).toHaveLength(0);
    expect(test.audits).toHaveLength(0);
  });

  it('enforces the stable reason invariant before persistence', async () => {
    for (const reason of ['   ', '\t\n', 'x', 'x'.repeat(501)]) {
      const test = harness();
      await expectCode(
        test.service.reissue({ originalIssueId: original.id, reason }, actor),
        'REISSUE_REASON_REQUIRED',
      );
      expect(test.created).toHaveLength(0);
    }
  });

  it('trims the reason, re-resolves the original template policy and stores one audit', async () => {
    const test = harness();
    const result = await test.service.reissue(
      { originalIssueId: original.id, reason: '  اصلاح شماره پیگیری  ' },
      actor,
    );
    expect(test.resolve).toHaveBeenCalledWith({
      documentType: original.documentType,
      templateId: original.templateId,
      templateVersion: original.templateVersion,
    });
    expect(test.created[0]).toMatchObject({
      reissueReason: 'اصلاح شماره پیگیری',
      templateId: original.templateId,
    });
    expect(test.audits[0]).toMatchObject({ reason: 'اصلاح شماره پیگیری' });
    expect(result.data.reissueReason).toBe('اصلاح شماره پیگیری');
  });

  it('rolls back the reissue when audit creation fails', async () => {
    const test = harness({ auditFails: true });
    await expect(
      test.service.reissue(
        { originalIssueId: original.id, reason: 'اصلاح معتبر' },
        actor,
      ),
    ).rejects.toThrow('audit failed');
    expect(test.created).toHaveLength(0);
    expect(test.audits).toHaveLength(0);
  });
});
