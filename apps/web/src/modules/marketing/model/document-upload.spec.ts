import { afterEach, describe, expect, it, vi } from 'vitest';
import { documentsApi } from '@/modules/documents/api/client';
import {
  appendMarketingConfidentialCode,
  marketingDocumentCodeError,
} from './document-upload';

vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'https://api.example.test',
}));
vi.mock('@/modules/notifications/api/client', () => ({
  notifyNotificationFeedChanged: vi.fn(),
}));
afterEach(() => vi.unstubAllGlobals());

describe('Marketing defers classification to the Documents public boundary', () => {
  it.each(['INTERNAL', 'RESTRICTED', 'CONFIDENTIAL'] as const)(
    'supports configured policy overriding type %s with and without a code',
    async (typeDefault) => {
      for (const configured of [
        undefined,
        'INTERNAL',
        'RESTRICTED',
        'CONFIDENTIAL',
      ]) {
        for (const code of ['', '123456']) {
          const effective = configured ?? typeDefault;
          // Public-owner response contract; this mock does not test Documents.
          vi.stubGlobal(
            'fetch',
            vi.fn(async (_url, init: RequestInit) => {
              const form = init.body as FormData;
              expect(form.has('confidentiality')).toBe(false);
              expect(form.get('confidentialAccessCode')).toBe(code || null);
              if (effective === 'CONFIDENTIAL' && !code)
                return new Response(
                  JSON.stringify({
                    code: 'DOCUMENT_CONFIDENTIAL_CODE_REQUIRED',
                    message: 'Code required',
                  }),
                  { status: 400 },
                );
              if (effective !== 'CONFIDENTIAL' && code)
                return new Response(
                  JSON.stringify({ message: 'Code forbidden' }),
                  { status: 400 },
                );
              return new Response(
                JSON.stringify({
                  data: { id: 'document', confidentiality: effective },
                }),
                { status: 201 },
              );
            }),
          );
          expect(marketingDocumentCodeError(code)).toBe('');
          const form = new FormData();
          appendMarketingConfidentialCode(form, code);
          if ((effective === 'CONFIDENTIAL') === Boolean(code))
            await expect(documentsApi.upload(form)).resolves.toMatchObject({
              data: { confidentiality: effective },
            });
          else
            await expect(documentsApi.upload(form)).rejects.toMatchObject({
              status: 400,
            });
        }
      }
    },
  );

  it('validates only supplied code syntax and lets users clear a code rejected by the owner', () => {
    expect(marketingDocumentCodeError('12345')).not.toBe('');
    expect(marketingDocumentCodeError('abcdef')).not.toBe('');
    expect(marketingDocumentCodeError('')).toBe('');
    const retry = new FormData();
    appendMarketingConfidentialCode(retry, '');
    expect(retry.has('confidentialAccessCode')).toBe(false);
    expect(retry.has('confidentiality')).toBe(false);
  });
});
