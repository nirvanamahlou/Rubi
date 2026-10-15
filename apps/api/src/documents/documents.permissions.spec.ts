import { describe, expect, it } from 'vitest';

import {
  authorizeDocumentAction,
  documentPermissionCodes,
  type DocumentsActorContext,
} from './documents.permissions';

const actor: DocumentsActorContext = {
  actorReference: 'preview-actor-1',
  branchReferences: ['branch-preview-tehran'],
  permissions: [...documentPermissionCodes],
};

describe('documents permission policy', () => {
  it('is deny-by-default for missing actor or operation permission', () => {
    expect(
      authorizeDocumentAction(null, {
        action: 'READ',
        branchReference: 'branch-preview-tehran',
        confidentiality: 'PUBLIC',
        reason: null,
      }),
    ).toMatchObject({ allowed: false, code: 'PERMISSION_REQUIRED' });
    expect(
      authorizeDocumentAction(
        { ...actor, permissions: [] },
        {
          action: 'DOWNLOAD',
          branchReference: 'branch-preview-tehran',
          confidentiality: 'INTERNAL',
          reason: null,
        },
      ).allowed,
    ).toBe(false);
  });

  it('prevents IDOR through exact branch scope', () => {
    expect(
      authorizeDocumentAction(actor, {
        action: 'READ',
        branchReference: 'branch-preview-mashhad',
        confidentiality: 'PUBLIC',
        reason: null,
      }),
    ).toEqual({
      allowed: false,
      masked: false,
      code: 'BRANCH_SCOPE_DENIED',
    });
  });

  it('masks sensitive records without sensitive permission', () => {
    const permissions = actor.permissions.filter(
      (permission) => permission !== 'documents.sensitive.read',
    );
    expect(
      authorizeDocumentAction(
        { ...actor, permissions },
        {
          action: 'READ',
          branchReference: 'branch-preview-tehran',
          confidentiality: 'CONFIDENTIAL',
          reason: 'بررسی پرونده مجاز',
        },
      ),
    ).toMatchObject({
      allowed: false,
      masked: true,
      code: 'SENSITIVE_PERMISSION_REQUIRED',
    });
  });

  it('accepts optional reasons with sensitive view and download permissions', () => {
    expect(
      authorizeDocumentAction(actor, {
        action: 'DOWNLOAD',
        branchReference: 'branch-preview-tehran',
        confidentiality: 'RESTRICTED',
        reason: '',
      }).allowed,
    ).toBe(true);
    expect(
      authorizeDocumentAction(actor, {
        action: 'DOWNLOAD',
        branchReference: 'branch-preview-tehran',
        confidentiality: 'RESTRICTED',
        reason: 'رسیدگی به درخواست رسمی',
      }).allowed,
    ).toBe(true);
  });
});
