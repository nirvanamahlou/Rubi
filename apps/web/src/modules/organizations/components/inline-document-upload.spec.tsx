import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { documentsApi } from '@/modules/documents/api/client';
import {
  ConfidentialAccessCodeInput,
  issueUploadedConfidentialGrant,
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
