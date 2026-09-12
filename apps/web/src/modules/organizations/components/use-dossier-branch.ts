'use client';
import { useEffect, useState } from 'react';
import type { BranchReference, IamPermissionCode } from '@rubi/contracts';
import { agencyClient } from '../api/agency-client';

export function useDossierBranch() {
  const [branches, setBranches] = useState<readonly BranchReference[]>([]);
  const [branchId, setBranchId] = useState('');
  const [permissions, setPermissions] = useState<readonly IamPermissionCode[]>(
    [],
  );
  const [sessionError, setSessionError] = useState('');
  useEffect(() => {
    let active = true;
    void agencyClient
      .session()
      .then((user) => {
        if (!active) return;
        setBranches(user.branches);
        setBranchId(user.branches[0]?.id ?? '');
        setPermissions(user.permissions);
        if (!user.branches.length)
          setSessionError('هیچ شعبه مجازی برای این حساب وجود ندارد.');
      })
      .catch((caught) => {
        if (active)
          setSessionError(
            caught instanceof Error ? caught.message : 'نشست معتبر نیست.',
          );
      });
    return () => {
      active = false;
    };
  }, []);
  return { branches, branchId, setBranchId, permissions, sessionError };
}
