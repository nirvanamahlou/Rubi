import { CustomersApiError } from '../api/client';

export type CustomerListFailureState = 'unauthorized' | 'forbidden' | 'error';

export function customerListFailureState(
  error: unknown,
): CustomerListFailureState {
  if (error instanceof CustomersApiError && error.status === 401)
    return 'unauthorized';
  if (error instanceof CustomersApiError && error.status === 403)
    return 'forbidden';
  return 'error';
}

export type CustomerConflictRefreshResult<TCustomer, TDraft> =
  | {
      status: 'refreshed';
      customer: TCustomer;
      draft: TDraft;
      message: string;
    }
  | {
      status: 'refresh-failed';
      draft: TDraft;
      message: string;
    };

export async function fetchCustomerConflictSnapshot<TCustomer, TDraft>(
  customerId: string,
  draft: TDraft,
  fetchDetail: (id: string) => Promise<TCustomer>,
): Promise<CustomerConflictRefreshResult<TCustomer, TDraft>> {
  try {
    const customer = await fetchDetail(customerId);
    return {
      status: 'refreshed',
      customer,
      draft,
      message:
        'رکورد توسط شخص دیگری تغییر کرده است. نسخه جدید سرور دریافت شد؛ تغییرات شما حفظ شده‌اند و باید آن‌ها را با نسخه جدید بررسی کنید.',
    };
  } catch {
    return {
      status: 'refresh-failed',
      draft,
      message:
        'رکورد توسط شخص دیگری تغییر کرده است، اما دریافت نسخه جدید ناموفق بود. تغییرات شما حفظ شده‌اند؛ دوباره تلاش کنید.',
    };
  }
}
