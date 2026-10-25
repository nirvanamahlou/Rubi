import type { AuthenticatedActor } from '@nora/contracts';
import {
  refreshAuthenticatedSession,
  SessionRefreshUnavailableError,
} from '@/lib/auth-session';

export type AccessSessionResult =
  | { status: 'ready'; actor: AuthenticatedActor }
  | { status: 'expired' | 'forbidden' };

/** Revalidate permissions without turning temporary connectivity into logout. */
export async function loadAccessSession(
  baseUrl: string,
): Promise<AccessSessionResult> {
  const access = () =>
    fetch(`${baseUrl}/iam/auth/access`, {
      credentials: 'include',
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
  let response = await access();
  if (response.status === 401) {
    if (!(await refreshAuthenticatedSession(baseUrl)))
      return { status: 'expired' };
    response = await access();
    // Another tab may rotate between recovery and this read. Retry on the next
    // check instead of redirecting based on a stale access-token response.
    if (response.status === 401) throw new SessionRefreshUnavailableError();
  }
  if (response.status === 403) return { status: 'forbidden' };
  if (!response.ok) throw new SessionRefreshUnavailableError();
  const actor = (await response.json()) as AuthenticatedActor;
  if (!Array.isArray(actor?.permissions))
    throw new SessionRefreshUnavailableError();
  return { status: 'ready', actor };
}
