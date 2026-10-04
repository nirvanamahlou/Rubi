import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { list } = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('@/modules/documents/api/client', () => ({
  documentsApi: { list, createAccessGrant: vi.fn() },
  DocumentsApiError: class DocumentsApiError extends Error {},
}));

import { protectedAgreementProofIds } from './agreement-workflow-panel';
import { agreementUploadContextKey } from '../model/agreement-terms';
import { blankAgreementTerms } from '../model/agreement-terms';
import { AgreementTermsEditor } from './agreement-terms-editor';

describe('agreement confidential proof discovery', () => {
  beforeEach(() => list.mockReset());

  it('finds a protected attached document beyond the first list page', async () => {
    list
      .mockResolvedValueOnce({
        data: [{ id: 'ordinary', requiresConfidentialAccessCode: false }],
        meta: { totalPages: 2 },
      })
      .mockResolvedValueOnce({
        data: [{ id: 'protected', requiresConfidentialAccessCode: true }],
        meta: { totalPages: 2 },
      });
    await expect(
      protectedAgreementProofIds('organization', 'branch', ['protected']),
    ).resolves.toEqual(new Set(['protected']));
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('fails closed when an attached ID cannot be resolved', async () => {
    list.mockResolvedValue({ data: [], meta: { totalPages: 1 } });
    await expect(
      protectedAgreementProofIds('organization', 'branch', ['missing']),
    ).rejects.toThrow('قابل تأیید نیست');
  });
});

describe('agreement upload context identity', () => {
  it('binds uploads to actor, organization, branch, and editor generation', () => {
    const key = agreementUploadContextKey(
      'actor',
      'organization',
      'branch',
      'editor-generation',
    );
    expect(key).toBe('actor|organization|branch|editor-generation');
    expect(
      agreementUploadContextKey(
        'other-actor',
        'organization',
        'branch',
        'editor-generation',
      ),
    ).not.toBe(key);
    expect(
      agreementUploadContextKey(
        'actor',
        'other-organization',
        'branch',
        'editor-generation',
      ),
    ).not.toBe(key);
    expect(
      agreementUploadContextKey(
        'actor',
        'organization',
        'other-branch',
        'editor-generation',
      ),
    ).not.toBe(key);
    expect(
      agreementUploadContextKey(
        'actor',
        'organization',
        'branch',
        'new-editor-generation',
      ),
    ).not.toBe(key);
  });
});

describe('agreement attachment permission preflight', () => {
  const renderEditor = (permissions: string[]) =>
    renderToStaticMarkup(
      <AgreementTermsEditor
        value={{
          ...blankAgreementTerms(),
          currencyCodes: ['IRR'],
          guarantees: [
            {
              kind: 'BANK_GUARANTEE',
              reference: 'ref',
              amount: '1',
              currencyCode: 'IRR',
              issuer: 'issuer',
              receivedAt: '2026-10-04',
              expiresAt: null,
              status: 'REQUIRED',
              documentId: null,
            },
          ],
        }}
        onChange={vi.fn()}
        role="AGENCY"
        branchId="branch"
        organizationId="organization"
        permissions={permissions as never}
        focus="guarantees"
      />,
    );

  it('blocks existing proof selection and upload before metadata-read is granted', () => {
    const markup = renderEditor([
      'documents.list',
      'documents.organization.read',
      'documents.upload',
    ]);
    const input = markup.match(
      /<input[^>]*aria-label="سند تضمین 1"[^>]*>/,
    )?.[0];
    expect(input).toContain(' disabled=""');
    expect(markup).not.toContain('بارگذاری فایل جدید برای سند تضمین 1');
  }, 30_000);

  it('allows selection and canonical upload when all attachment permissions exist', () => {
    const markup = renderEditor([
      'documents.list',
      'documents.organization.read',
      'documents.metadata.read',
      'documents.upload',
    ]);
    const input = markup.match(
      /<input[^>]*aria-label="سند تضمین 1"[^>]*>/,
    )?.[0];
    expect(input).not.toContain(' disabled=""');
    expect(markup).toContain('بارگذاری فایل جدید برای سند تضمین 1');
  }, 30_000);
});
