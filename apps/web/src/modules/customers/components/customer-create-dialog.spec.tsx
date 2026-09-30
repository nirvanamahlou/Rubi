import { afterEach, describe, expect, it, vi } from 'vitest';

import { customersApi, type CustomersApiError } from '../public/entry';

const originalBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalBaseUrl === undefined)
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
  else process.env.NEXT_PUBLIC_API_BASE_URL = originalBaseUrl;
});

describe('Customers-owned creation from another form', () => {
  it.each([403, 409])(
    'preserves a create failure with status %s',
    async (status) => {
      process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status,
        json: async () => ({
          error: {
            code:
              status === 403
                ? 'PERMISSION_DENIED'
                : 'CUSTOMER_NATIONAL_ID_EXISTS',
            message: 'ثبت مشتری مجاز نیست.',
          },
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      await expect(
        customersApi.create({
          kind: 'person',
          firstName: 'نام',
          lastName: 'نمونه',
          displayName: 'نام نمونه',
          nationalId: '0084575948',
          roles: ['customer'],
        }),
      ).rejects.toMatchObject({
        status,
        code:
          status === 403 ? 'PERMISSION_DENIED' : 'CUSTOMER_NATIONAL_ID_EXISTS',
      } satisfies Partial<CustomersApiError>);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]![1]).toMatchObject({
        method: 'POST',
        credentials: 'include',
      });
    },
  );
});
