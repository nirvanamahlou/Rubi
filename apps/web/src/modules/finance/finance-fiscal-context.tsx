'use client';

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  FinanceFiscalContextV1,
  FinanceFiscalPeriodV1,
} from '@nora/contracts';
import {
  useAccessActor,
  useAccessPermissions,
  useRouteAccess,
} from '@/modules/iam/access-context';
import { useLegalEntityContext } from '@/modules/legal-entities/components/legal-entity-context';
import { apiRequest } from './api/finance-inbox-api';
import {
  fiscalHintKey,
  fiscalRequestServerSnapshot,
  fiscalRequestSnapshot,
  setFiscalRequestHint,
  subscribeFiscalRequest,
} from './fiscal-request-state';

type State = {
  active: boolean;
  data: FinanceFiscalContextV1 | undefined;
  period: FinanceFiscalPeriodV1 | null;
  temporary: boolean;
  loading: boolean;
  writing: boolean;
  error: string | null;
  key: string;
  select(id: string): void;
  reload(): void;
};
const FiscalContext = createContext<State | null>(null);
export const useFinanceFiscalContext = () => useContext(FiscalContext);

export function FinanceFiscalProvider({ children }: { children: ReactNode }) {
  const path = usePathname();
  const permissions = useAccessPermissions();
  const actor = useAccessActor();
  const canRoute = useRouteAccess();
  const company = useLegalEntityContext();
  const client = useQueryClient();
  const active =
    (path === '/finance' || path.startsWith('/finance/')) &&
    !!permissions?.includes('finance.read') &&
    canRoute(path);
  const selection = company.context?.selection ?? '';
  const [visit, setVisit] = useState<{
    active: boolean;
    actorId: string | undefined;
    epoch: number;
    temporary: Record<string, string>;
  }>({ active, actorId: actor?.userId, epoch: 0, temporary: {} });
  if (visit.active !== active || visit.actorId !== actor?.userId)
    setVisit({
      active,
      actorId: actor?.userId,
      epoch: visit.epoch + 1,
      temporary: {},
    });
  const query = useQuery({
    queryKey: [
      'finance-fiscal-context',
      actor?.userId,
      selection,
      company.context?.version,
      visit.epoch,
    ],
    queryFn: () =>
      apiRequest<FinanceFiscalContextV1>('/finance/fiscal-context'),
    enabled:
      active &&
      !!actor?.userId &&
      !!selection &&
      !company.loading &&
      !company.switching,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: active ? 60_000 : false,
  });
  const data =
    active && query.data?.companySelection === selection
      ? query.data
      : undefined;
  const companyKey = data?.company?.id ?? selection;
  const personalId =
    visit.active === active ? visit.temporary[companyKey] : undefined;
  const personal = data?.periods.find((row) => row.id === personalId);
  const period =
    personal ??
    data?.periods.find((row) => row.id === data.defaultPeriodId) ??
    null;
  const hint = useMemo(
    () =>
      active && data
        ? {
            actorKey: actor?.userId,
            companySelection: selection,
            period,
            mode: personal ? ('temporary' as const) : ('default' as const),
          }
        : null,
    [active, actor?.userId, data, selection, period, personal],
  );
  const key = fiscalHintKey(hint);
  const transport = useSyncExternalStore(
    subscribeFiscalRequest,
    fiscalRequestSnapshot,
    fiscalRequestServerSnapshot,
  );
  useLayoutEffect(() => {
    if (transport.key === key) return;
    void client.cancelQueries({
      predicate: (q) =>
        /^(?:finance|accounting)/.test(String(q.queryKey[0])) &&
        q.queryKey[0] !== 'finance-fiscal-context',
    });
    client.removeQueries({
      predicate: (q) =>
        /^(?:finance|accounting)/.test(String(q.queryKey[0])) &&
        q.queryKey[0] !== 'finance-fiscal-context',
    });
    setFiscalRequestHint(hint);
  }, [client, hint, key, transport.key]);
  useLayoutEffect(() => () => setFiscalRequestHint(null), []);
  const value: State = {
    active,
    data,
    period,
    temporary: !!personal,
    loading:
      active &&
      !company.error &&
      (company.loading ||
        company.switching ||
        (!query.isError && (query.isPending || !data)) ||
        (!!data && transport.key !== key)),
    writing: transport.writing > 0,
    error:
      company.error ??
      (query.error instanceof Error ? query.error.message : null),
    key,
    select: (id) => {
      if (
        !transport.writing &&
        (!id || data?.periods.some((row) => row.id === id))
      )
        setVisit((state) => ({
          ...state,
          temporary: { ...state.temporary, [companyKey]: id },
        }));
    },
    reload: () => {
      if (company.error) void company.reload();
      else void query.refetch();
    },
  };
  return (
    <FiscalContext.Provider value={value}>{children}</FiscalContext.Provider>
  );
}
