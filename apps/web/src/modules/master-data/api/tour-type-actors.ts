import { getPublicApiBaseUrl } from '@/lib/environment';

/** IAM authorizes this public endpoint; a denied lookup never blocks the catalog. */
export async function loadTourTypeActorNames(signal?: AbortSignal) {
  const names: Record<string, string> = {};
  const base = getPublicApiBaseUrl();
  if (!base) return names;
  try {
    const response = await fetch(`${base}/iam/users`, {
      credentials: 'include',
      cache: 'no-store',
      ...(signal ? { signal } : {}),
    });
    if (!response.ok) return names;
    const users: unknown = await response.json();
    if (!Array.isArray(users)) return names;
    for (const user of users) {
      if (
        user &&
        typeof user.id === 'string' &&
        typeof user.displayName === 'string'
      )
        names[user.id] = user.displayName;
    }
  } catch {
    // No role elevation, login refresh, persisted cache or IAM data fallback.
  }
  return names;
}
