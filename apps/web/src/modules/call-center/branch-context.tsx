'use client';
import { useEffect, useState, type ReactNode } from 'react';
import type { AuthenticatedActor } from '@nora/contracts';
import { readApi } from './read-client';
import { resolvedCallCenterBranch } from './resolve-branch';
export { resolvedCallCenterBranch } from './resolve-branch';

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
