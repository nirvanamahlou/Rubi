import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { documentsApi } from '@/modules/documents/api/client';
import {
  ConfidentialAccessCodeInput,
  issueUploadedConfidentialGrant,
  publishUploadedDocumentAfterGrant,
} from './inline-document-upload';

describe('inline confidential document code', () => {
  it('issues a grant only for an explicitly opted-in agreement upload', async () => {
    const create = vi
      .spyOn(documentsApi, 'createAccessGrant')
      .mockResolvedValue({
        data: {
          token: 'fresh-token',
          purpose: 'CONFIDENTIAL_VIEW',
          expiresAt: '2026-10-04T12:05:00.000Z',
        },
      });
    await expect(
      issueUploadedConfidentialGrant('document', '123456', false),
    ).resolves.toBeUndefined();
    expect(create).not.toHaveBeenCalled();
    await expect(
      issueUploadedConfidentialGrant('document', '123456', true),
    ).resolves.toBe('fresh-token');
    expect(create).toHaveBeenCalledExactlyOnceWith('document', {
      code: '123456',
      purpose: 'CONFIDENTIAL_VIEW',
    });
    create.mockRestore();
  });

  it('publishes a confidential upload after grant issuance even though selecting it changes the target ID', async () => {
    let resolveGrant!: (token: string) => void;
    const grant = new Promise<string>((resolve) => (resolveGrant = resolve));
    let selectedDocumentId = 'previous-document';
    const slotContext = 'actor|organization|branch|editor|contract-slot';
    const currentContext = slotContext;
    const publish = vi.fn((documentId: string, token?: string) => {
      selectedDocumentId = documentId;
      // A rerender after selecting the new ID must retain this slot's
      // authority; the operation is not bound to the mutable selected ID.
      expect(currentContext).toBe(slotContext);
      expect(token).toBe('fresh-token');
    });
    const completion = publishUploadedDocumentAfterGrant(
      {
        isCurrent: () => currentContext === slotContext,
        publish,
      },
      'uploaded-document',
      () => grant,
    );

    expect(selectedDocumentId).toBe('previous-document');
    resolveGrant('fresh-token');
    await expect(completion).resolves.toEqual({
      current: true,
      grantError: undefined,
    });
    expect(selectedDocumentId).toBe('uploaded-document');
    expect(publish).toHaveBeenCalledExactlyOnceWith(
      'uploaded-document',
      'fresh-token',
    );
  });

  it('discards a delayed grant after the same actor starts a new session', async () => {
    let resolveGrant!: (token: string) => void;
    const grant = new Promise<string>((resolve) => (resolveGrant = resolve));
    let currentContext =
      'actor|old-session|organization|branch|editor|contract-slot';
    const originalContext = currentContext;
    const publish = vi.fn();
    const completion = publishUploadedDocumentAfterGrant(
      {
        isCurrent: () => currentContext === originalContext,
        publish,
      },
      'uploaded-document',
      () => grant,
    );

    currentContext =
      'actor|new-session|organization|branch|editor|contract-slot';
    resolveGrant('fresh-token');
    await expect(completion).resolves.toEqual({
      current: false,
      grantError: undefined,
    });
    expect(publish).not.toHaveBeenCalled();
  });

  it('discards a delayed grant after an external proof selection changes', async () => {
    let resolveGrant!: (token: string) => void;
    const grant = new Promise<string>((resolve) => (resolveGrant = resolve));
    let currentContext = 'actor|session|organization|branch|proof-a|editor';
    const originalContext = currentContext;
    const publish = vi.fn();
    const completion = publishUploadedDocumentAfterGrant(
      {
        isCurrent: () => currentContext === originalContext,
        publish,
      },
      'uploaded-document',
      () => grant,
    );

    currentContext = 'actor|session|organization|branch|proof-b|editor';
    resolveGrant('fresh-token');
    await expect(completion).resolves.toEqual({
      current: false,
      grantError: undefined,
    });
    expect(publish).not.toHaveBeenCalled();
  });

  it('validates only when Upload is requested and does not block the parent signatory form', () => {
    const markup = renderToStaticMarkup(
      <form>
        <ConfidentialAccessCodeInput value="" onChange={vi.fn()} />
        <button type="submit">ذخیره غیرفعال</button>
      </form>,
    );
    expect(markup).toContain('کد دسترسی سند محرمانه');
    expect(markup).not.toContain('required=""');
    expect(markup).not.toContain('pattern=');
    expect(markup).toContain('maxLength="6"');
  });
});
