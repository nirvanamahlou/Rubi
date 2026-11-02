'use client';
import { useEffect, useState, type ReactNode } from 'react';
import type { AuthenticatedActor } from '@nora/contracts';
import { readApi } from './read-client';

export function resolvedCallCenterBranch(
  allowed: readonly string[],
  response: {
    data: { id: string }[];
    meta?: { defaultBranchId: string | null };
  },
) {
  const ids = response.data
    .map((branch) => branch.id)
    .filter((id) => allowed.includes(id));
  const preferred = response.meta?.defaultBranchId;
  if (preferred && ids.includes(preferred)) return preferred;
  // A legacy single-branch API is safe; ambiguous responses must not choose an
  // arbitrary login branch or fall through to another company's records.
  return ids.length === 1 && !preferred ? ids[0]! : null;
}

export function CallCenterBranchContext({
  actor,
  children,
}: {
  actor: AuthenticatedActor;
  children: (branch: string) => ReactNode;
}) {
  const allowedBranches = actor.branchIds.join(',');
  const identity = `${actor.userId}:${allowedBranches}:${actor.permissions.join(',')}`;
  const [resolved, setResolved] = useState<{
    identity: string;
    branch: string | null;
    error?: string;
  } | null>(null);
  const bootstrap = actor.branchIds[0];
  useEffect(() => {
    if (!bootstrap) return;
    const controller = new AbortController();
    void readApi
      .branches(bootstrap, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted)
          setResolved({
            identity,
            branch: resolvedCallCenterBranch(
              allowedBranches.split(','),
              response,
            ),
          });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResolved({
            identity,
            branch: null,
            ...(error instanceof Error ? { error: error.message } : {}),
          });
      });
    return () => controller.abort();
  }, [identity, bootstrap, allowedBranches]);
  if (!resolved || resolved.identity !== identity)
    return <p role="status">در حال دریافت دسترسی کال سنتر…</p>;
  if (!resolved.branch)
    return <p role="alert">{resolved.error || 'شعبه مجازی در دسترس نیست.'}</p>;
  return children(resolved.branch);
}
