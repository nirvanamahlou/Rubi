import { ServiceError } from './errors.mjs';
import { getTool } from './tools.mjs';
export function accessCookie(raw) {
  if (typeof raw !== 'string') return null;
  const matches = raw
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith('nora_access='));
  if (
    matches.length !== 1 ||
    !/^nora_access=[A-Za-z0-9_.%~-]{1,8192}$/.test(matches[0])
  )
    return null;
  return matches[0];
}
export function createAuthorization(client) {
  async function authenticate(cookie, signal, expectedUserId, source) {
    const actor = await client.identity(cookie, signal, source);
    if (
      !actor ||
      typeof actor.userId !== 'string' ||
      !actor.userId ||
      !Array.isArray(actor.permissions) ||
      !Array.isArray(actor.branchIds) ||
      !actor.permissions.every((value) => typeof value === 'string') ||
      !actor.branchIds.every((value) => typeof value === 'string')
    )
      throw new ServiceError(502, 'INVALID_IDENTITY');
    // Public authenticated SELF access does not confer any corporate data grant.
    // Source APIs remain authoritative; the legacy executive grant is reserved.
    if (expectedUserId && actor.userId !== expectedUserId)
      throw new ServiceError(403, 'FORBIDDEN');
    return actor;
  }
  return authenticate;
}
export function isToolAllowed(actor, id) {
  return Boolean(
    actor &&
    Array.isArray(actor.permissions) &&
    getTool(id).permissions.every((permission) =>
      actor.permissions.includes(permission),
    ),
  );
}
export function requireToolAccess(actor, id) {
  if (!isToolAllowed(actor, id)) throw new ServiceError(403, 'FORBIDDEN');
}
