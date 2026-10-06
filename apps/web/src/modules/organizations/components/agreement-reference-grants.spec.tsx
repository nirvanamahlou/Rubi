import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { list } = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('@/modules/documents/api/client', () => ({
  documentsApi: { list, createAccessGrant: vi.fn() },
  DocumentsApiError: class DocumentsApiError extends Error {},
}));

import {
  protectedAgreementProofIds,
  rejectedAgreementReferenceGrantState,
  savedAgreementSubmission,
  savedAgreementSubmitPayload,
  uploadedAgreementReferenceState,
} from './agreement-workflow-panel';
import {
  agreementUploadContextKey,
  agreementUploadIsBusy,
  blankAgreementTerms,
} from '../model/agreement-terms';
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

  it('keeps a newly issued upload grant under the next proof scope while discovery runs', () => {
    const state = uploadedAgreementReferenceState(
      'actor|session|organization|branch|next-proof|editor-generation',
      'new-protected-document',
      'fresh-token',
    );
    expect(state.phase).toBe('checking');
    expect(state.protectedReferences).toEqual(
      new Set(['new-protected-document']),
    );
    expect(state.grants).toEqual({ 'new-protected-document': 'fresh-token' });
    expect(state.codes).toEqual({});
  });

  it('clears only rejected grants and transient codes without changing proof scope', () => {
    const state = {
      ...uploadedAgreementReferenceState(
        'actor|session|organization|branch|proof|editor',
        'protected-document',
        'expired-token',
      ),
      phase: 'ready' as const,
      codes: { 'protected-document': '123456', 'other-document': '654321' },
      grants: {
        'protected-document': 'expired-token',
        'other-document': 'other-token',
      },
      protectedReferences: new Set(['protected-document', 'other-document']),
    };
    const renewed = rejectedAgreementReferenceGrantState(state, [
      'protected-document',
    ]);

    expect(renewed.scope).toBe(state.scope);
    expect(renewed.phase).toBe('ready');
    expect(renewed.protectedReferences).toEqual(state.protectedReferences);
    expect(renewed.grants).toEqual({ 'other-document': 'other-token' });
    expect(renewed.codes).toEqual({
      'protected-document': '',
      'other-document': '654321',
    });
    expect(state.grants['protected-document']).toBe('expired-token');
  });
});

describe('agreement save-and-publish request identity', () => {
  it('submits the exact saved record with a distinct, version-pinned request', () => {
    const savedRecord = {
      id: 'saved-agreement-id',
      version: 7,
      revisions: [{ id: 'saved-revision-id', number: 3 }],
    } as never;
    const action = savedAgreementSubmission(savedRecord, {
      actorIdentityKey: 'actor',
      contextKey: 'actor|session|organization|branch|AGENCY|agreements',
      saveRequestId: 'save-request-id',
      requestId: 'submit-request-id',
      grantContextKey: 'fresh-submit-scope',
    });

    expect(action.record).toBe(savedRecord);
    expect(action.record.id).toBe('saved-agreement-id');
    expect(action.requestId).not.toBe(action.saveRequestId);
    expect(
      savedAgreementSubmitPayload(action, 'branch', 'AGENCY', [
        { documentId: 'proof', token: 'fresh-grant' },
      ]),
    ).toEqual({
      branchId: 'branch',
      role: 'AGENCY',
      requestId: 'submit-request-id',
      version: 7,
      reason: 'ارسال برای بررسی قرارداد و اعتبار',
      referenceGrants: [{ documentId: 'proof', token: 'fresh-grant' }],
    });
    expect(() =>
      savedAgreementSubmission(savedRecord, {
        actorIdentityKey: 'actor',
        contextKey: 'context',
        saveRequestId: 'same-id',
        requestId: 'same-id',
        grantContextKey: 'fresh-submit-scope',
      }),
    ).toThrow('شناسه‌های درخواست جداگانه');
  });
});

describe('agreement upload context identity', () => {
  it('binds uploads to actor, organization, branch, and editor generation', () => {
    const key = agreementUploadContextKey(
      'actor',
      'session',
      'organization',
      'branch',
      'editor-generation',
    );
    expect(key).toBe('actor|session|organization|branch|editor-generation');
    expect(
      agreementUploadContextKey(
        'actor',
        'session',
        'organization',
        'branch',
        'editor-generation',
      ),
    ).toBe(key);
    expect(
      agreementUploadContextKey(
        'other-actor',
        'session',
        'organization',
        'branch',
        'editor-generation',
      ),
    ).not.toBe(key);
    expect(
      agreementUploadContextKey(
        'actor',
        'other-session',
        'organization',
        'branch',
        'editor-generation',
      ),
    ).not.toBe(key);
    expect(
      agreementUploadContextKey(
        'actor',
        'session',
        'other-organization',
        'branch',
        'editor-generation',
      ),
    ).not.toBe(key);
    expect(
      agreementUploadContextKey(
        'actor',
        'session',
        'organization',
        'other-branch',
        'editor-generation',
      ),
    ).not.toBe(key);
    expect(
      agreementUploadContextKey(
        'actor',
        'session',
        'organization',
        'branch',
        'new-editor-generation',
      ),
    ).not.toBe(key);
  });

  it('gates upload busy state only for the owning editor context', () => {
    const original = agreementUploadContextKey(
      'actor-a',
      'session-a',
      'organization',
      'branch',
      'editor-a',
    );
    const sameEditor = agreementUploadContextKey(
      'actor-a',
      'session-a',
      'organization',
      'branch',
      'editor-a',
    );
    const nextActor = agreementUploadContextKey(
      'actor-b',
      'session-b',
      'organization',
      'branch',
      'editor-b',
    );

    expect(agreementUploadIsBusy(sameEditor, original)).toBe(true);
    expect(agreementUploadIsBusy(nextActor, original)).toBe(false);
    expect(agreementUploadIsBusy(nextActor, nextActor)).toBe(true);
    expect(agreementUploadIsBusy('', original)).toBe(false);
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
    expect(markup).not.toContain('type="file"');
    expect(markup).not.toContain('بدون پیوست');
  }, 30_000);

  it('allows selection and canonical upload when all attachment permissions exist', () => {
    const markup = renderEditor([
      'documents.list',
      'documents.organization.read',
      'documents.metadata.read',
      'documents.upload',
    ]);
    expect(markup).toContain('type="file"');
    expect(markup).toContain('اطلاعات و فایل سند تضمین 1');
    expect(markup).not.toContain('بدون پیوست');
    expect(markup).not.toContain(
      '<details class="rounded-xl border border-dashed p-3">',
    );
    expect(markup).not.toContain('ذخیره، پیش‌نویس ایجاد می‌کند');
  }, 30_000);
});
