import type {
  CustomerConsentChannel,
  CustomerConsentRequest,
  CustomerConsentStatus,
} from '@rubi/contracts';

import { CustomersApiError } from '../api/client';

const consentReasonEmail = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i;
const consentReasonLongNumber = /(?:\d[\s()-]?){10,}/;
const consentReasonSecret =
  /\b(?:bearer\s+\S+|(?:api[_-]?key|password|secret|token)\s*[:=]\s*\S+)/i;

export type CustomerConsentInput = {
  status: CustomerConsentStatus;
  channel: CustomerConsentChannel;
  source: string;
  reason: string;
  version: number;
};

export type CustomerConsentValidationResult =
  | { ok: true; request: CustomerConsentRequest }
  | { ok: false; message: string };

export function buildCustomerConsentRequest(
  input: CustomerConsentInput,
): CustomerConsentValidationResult {
  const reason = input.reason.trim();
  if (reason.length < 3)
    return { ok: false, message: 'دلیل رضایت باید حداقل ۳ نویسه باشد.' };
  if (reason.length > 500)
    return { ok: false, message: 'دلیل رضایت نباید بیش از ۵۰۰ نویسه باشد.' };
  if (
    consentReasonEmail.test(reason) ||
    consentReasonLongNumber.test(reason) ||
    consentReasonSecret.test(reason)
  )
    return {
      ok: false,
      message:
        'دلیل رضایت نباید شامل اطلاعات تماس، شناسه حساس یا اطلاعات محرمانه باشد.',
    };

  return {
    ok: true,
    request: {
      purpose: 'marketing',
      channel: input.channel,
      status: input.status,
      source: input.source.trim(),
      reason,
      version: input.version,
    },
  };
}

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
