import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
export interface PassengerName {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  ageCategory: 'ADL' | 'CHD' | 'INF' | null;
  gender: 'M' | 'F' | null;
  passportFirstName: string | null;
  passportLastName: string | null;
  nationalityCode: string | null;
  birthDate: string | null;
  birthDateMasked: boolean;
  nationalId: string | null;
  nationalIdMasked: boolean;
  passportNumber: string | null;
  passportNumberMasked: boolean;
  passportExpiryDate: string | null;
  passportIssuePlace: string | null;
  birthCountryCode: string | null;
  version: number;
}
export interface PassengersResponse {
  data: PassengerName[];
  canEdit: boolean;
}
export class PassengerFilesError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export async function passengerFilesRequest<T>(
  id: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('نشانی سرور تنظیم نشده است.');
  const send = () =>
    fetch(`${base}/reservations/requests/${encodeURIComponent(id)}/${path}`, {
      ...init,
      credentials: 'include',
      cache: 'no-store',
    });
  let response = await send();
  if (response.status === 401 && (await refreshAuthenticatedSession(base)))
    response = await send();
  const result = await response.json().catch(() => null);
  if (!response.ok)
    throw new PassengerFilesError(
      typeof result?.message === 'string'
        ? result.message
        : 'عملیات انجام نشد؛ اتصال و مجوزها را بررسی کنید.',
      response.status,
    );
  return result as T;
}
