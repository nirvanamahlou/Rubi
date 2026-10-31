/** Deployment-only policy. Browser headers, route names and display roles cannot select it. */
import type { AuthenticatedActor } from '@nora/contracts';

const nativeActors = new WeakMap<AuthenticatedActor, AuthenticatedActor>();
export function callCenterScopedActor(
  native: AuthenticatedActor,
  scoped: AuthenticatedActor,
) {
  nativeActors.set(scoped, callCenterSourceActor(native));
  return scoped;
}
/** Restore native branch scope before calling a different module's public authorization port. */
export function callCenterSourceActor(actor: AuthenticatedActor) {
  return nativeActors.get(actor) ?? actor;
}

export function answeredCallAccess() {
  if (process.env.CALL_CENTER_ACCESS_POLICY === 'LOCAL_TEST') return false;
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.CALL_CENTER_ACCESS_POLICY === 'ANSWERED'
  );
}

export function globalCallCenterIds() {
  return (process.env.CALL_CENTER_GLOBAL_USER_IDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value,
      ),
    );
}
