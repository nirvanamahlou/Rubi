'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { redirect, usePathname, useSearchParams } from 'next/navigation';
import Link from '@/i18n/link';
import {
  canViewRoute,
  accessGroupForRoute,
  USER_ACCESS_SCREENS,
  canViewScreen,
  canUseMasterDataResource,
  screenForTab,
  type AuthenticatedActor,
  type MasterDataResource,
} from '@nora/contracts';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { AUTH_SESSION_RECOVERED_EVENT } from '@/lib/auth-session';
import { loadAccessSession } from './access-session';
const ActorContext = createContext<AuthenticatedActor | null>(null);
export function useAccessActor() {
  return useContext(ActorContext);
}
const AccessContext = createContext<readonly string[] | null | undefined>(
  undefined,
);
export const AccessPermissionsProvider = AccessContext.Provider;
export function useAccessPermissions() {
  return useContext(AccessContext);
}
export function useRouteAccess() {
  const permissions = useAccessPermissions();
  return useCallback(
    (href: string) =>
      permissions === undefined ||
      (permissions !== null && canViewRoute(permissions, href)),
    [permissions],
  );
}
export function useScreenAccess() {
  const permissions = useAccessPermissions();
  return useCallback(
    (id: string) =>
      permissions === undefined ||
      (permissions !== null && canViewScreen(permissions, id)),
    [permissions],
  );
}
export function useMasterDataResourceAccess() {
  const permissions = useAccessPermissions();
  return useCallback(
    (resource: MasterDataResource) =>
      Array.isArray(permissions) &&
      canUseMasterDataResource(permissions, resource),
    [permissions],
  );
}
export function useTabAccess() {
  const pathname = usePathname();
  const query = useSearchParams();
  const allowed = useScreenAccess();
  return (value: string) => {
    const screen = screenForTab(
      pathname ?? '/',
      value,
      Object.fromEntries(query?.entries() ?? []),
    );
    return tabAccessDecision(screen?.id, allowed);
  };
}
export function tabAccessDecision(
  screenId: string | undefined,
  canView: (id: string) => boolean,
) {
  return screenId ? canView(screenId) : true;
}
export function AccessProvider({ children }: { children: ReactNode }) {
  const [permissions, setPermissions] = useState<readonly string[] | null>(
    null,
  );
  const [actor, setActor] = useState<AuthenticatedActor | null>(null);
  const [error, setError] = useState(false);
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    let active = true;
    let loading = false;
    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        const base = getPublicApiBaseUrl();
        if (!base) throw Error();
        const result = await loadAccessSession(base);
        if (result.status === 'expired') {
          if (active) setExpired(true);
          return;
        }
        if (result.status === 'forbidden') {
          if (active) {
            setActor(null);
            setPermissions([]);
            setError(false);
          }
          return;
        }
        if (result.status !== 'ready') return;
        const actor = result.actor;
        if (active) {
          setActor(actor);
          setPermissions(actor.permissions);
          setError(false);
        }
      } catch {
        if (active) {
          // Keep the authenticated subtree mounted during temporary outages;
          // API authorization still runs on every operation.
          setError(true);
        }
      } finally {
        loading = false;
      }
    };
    void load();
    const refresh = () => void load();
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    window.addEventListener(AUTH_SESSION_RECOVERED_EVENT, refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener(AUTH_SESSION_RECOVERED_EVENT, refresh);
    };
  }, []);
  if (expired) redirect('/login');
  return (
    <ActorContext.Provider value={actor}>
      <AccessContext.Provider value={permissions}>
        {permissions === null ? (
          <div role="status" className="p-6 text-center">
            {error
              ? 'ارتباط با سامانه برقرار نشد؛ تلاش مجدد به‌صورت خودکار انجام می‌شود.'
              : 'در حال بررسی دسترسی…'}
          </div>
        ) : (
          children
        )}
      </AccessContext.Provider>
    </ActorContext.Provider>
  );
}
export function RouteAccessGuard({ children }: { children: ReactNode }) {
  const route = usePathname();
  const search = useSearchParams();
  const allowed = useRouteAccess();
  const permissions = useAccessPermissions();
  const group = accessGroupForRoute(route ?? '/');
  const base = route === '/hr' ? '/human-resources' : route;
  if (!allowed(route + '?' + search.toString())) return null;
  if (
    permissions &&
    group &&
    base === group.route &&
    !search.size &&
    !USER_ACCESS_SCREENS.some(
      (screen) =>
        screen.group === group.id &&
        screen.route === base &&
        !screen.query &&
        canViewScreen(permissions, screen.id),
    )
  ) {
    const screens = USER_ACCESS_SCREENS.filter(
      (screen) =>
        screen.group === group.id &&
        (!screen.tab || screen.query) &&
        canViewScreen(permissions, screen.id),
    );
    return (
      <div className="grid gap-3 p-4">
        {screens.map((screen) => (
          <Link
            key={screen.id}
            className="rounded-xl border p-3"
            href={
              screen.route +
              (screen.query
                ? '?' + new URLSearchParams(screen.query).toString()
                : '')
            }
          >
            {screen.title}
          </Link>
        ))}
      </div>
    );
  }
  return allowed(route + '?' + search.toString()) ? children : null;
}
