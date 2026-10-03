'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  BranchReference,
  IamPermissionCode,
  LoginResponse,
} from '@nora/contracts';
import { AUTH_SESSION_RECOVERED_EVENT } from '@/lib/auth-session';
import { agencyClient } from '../api/agency-client';
import { dossierSessionProjection } from '../model/dossier-session';

export function useDossierBranch() {
  const [branches, setBranches] = useState<readonly BranchReference[]>([]);
  const [branchId, setBranchId] = useState('');
  const [permissions, setPermissions] = useState<readonly IamPermissionCode[]>(
    [],
  );
  const [sessionError, setSessionError] = useState('');
  const [sessionContextKey, setSessionContextKey] = useState('');
  const request = useRef(0);
  const selectedBranch = useRef('');
  const selectBranch = useCallback((branch: string) => {
    selectedBranch.current = branch;
    setBranchId(branch);
  }, []);
  const applyUser = useCallback(
    (user: LoginResponse['user'], current: number) => {
      if (current !== request.current) return;
      const projection = dossierSessionProjection(
        user,
        current,
        selectedBranch.current,
      );
      selectedBranch.current = projection.branchId;
      setBranchId(projection.branchId);
      setBranches(projection.branches);
      setPermissions(projection.permissions);
      setSessionError(projection.error);
      setSessionContextKey(projection.contextKey);
    },
    [],
  );
  const invalidate = useCallback(() => {
    const current = ++request.current;
    setSessionContextKey('');
    setPermissions([]);
    setSessionError('');
    return current;
  }, []);
  const reload = useCallback(() => {
    const current = invalidate();
    void agencyClient
      .session()
      .then((user) => applyUser(user, current))
      .catch((caught) => {
        if (current !== request.current) return;
        setBranches([]);
        selectedBranch.current = '';
        setBranchId('');
        setSessionError(
          caught instanceof Error ? caught.message : 'نشست معتبر نیست.',
        );
      });
  }, [applyUser, invalidate]);
  const cancelPending = useCallback(() => {
    ++request.current;
  }, []);
  useEffect(() => {
    const recovered = (event: Event) => {
      const current = invalidate();
      applyUser((event as CustomEvent<LoginResponse>).detail.user, current);
    };
    const timer = window.setTimeout(reload, 0);
    window.addEventListener('focus', reload);
    window.addEventListener(AUTH_SESSION_RECOVERED_EVENT, recovered);
    return () => {
      window.clearTimeout(timer);
      cancelPending();
      window.removeEventListener('focus', reload);
      window.removeEventListener(AUTH_SESSION_RECOVERED_EVENT, recovered);
    };
  }, [applyUser, cancelPending, invalidate, reload]);
  return {
    branches,
    branchId,
    setBranchId: selectBranch,
    permissions,
    sessionError,
    sessionContextKey,
  };
}
