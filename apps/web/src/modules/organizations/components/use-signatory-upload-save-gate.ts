'use client';

import { useCallback, useState } from 'react';

/** Keeps an unresolved upload gate attached to one editor operation. */
export function useSignatoryUploadSaveGate(operationKey: string) {
  const [blockedOperationKey, setBlockedOperationKey] = useState('');
  const update = useCallback(
    (candidateKey: string, blocked: boolean) => {
      if (!candidateKey || candidateKey !== operationKey) return;
      setBlockedOperationKey((current) =>
        blocked ? candidateKey : current === candidateKey ? '' : current,
      );
    },
    [operationKey],
  );
  return {
    blocked: Boolean(operationKey) && blockedOperationKey === operationKey,
    update,
  };
}
