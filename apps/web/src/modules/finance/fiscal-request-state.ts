import type { FinanceFiscalPeriodV1 } from '@nora/contracts';

export type FiscalRequestHint = {
  actorKey?: string | undefined;
  companySelection: string;
  period: FinanceFiscalPeriodV1 | null;
  mode: 'default' | 'temporary';
};
type State = { key: string; hint: FiscalRequestHint | null; writing: number };
const empty: State = { key: '', hint: null, writing: 0 };
let state: State = empty;
const listeners = new Set<() => void>();
const publish = (next: State) => {
  state = next;
  listeners.forEach((notify) => notify());
};
export const subscribeFiscalRequest = (notify: () => void) => {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
};
export const fiscalRequestSnapshot = () => state;
export const fiscalRequestServerSnapshot = () => empty;
export function fiscalHintKey(hint: FiscalRequestHint | null) {
  return hint
    ? `${hint.actorKey ?? ''}:${hint.companySelection}:${hint.period?.bookId ?? ''}:${hint.period?.id ?? 'undefined'}:${hint.period?.version ?? ''}:${hint.mode}`
    : '';
}
export function setFiscalRequestHint(hint: FiscalRequestHint | null) {
  if (typeof window === 'undefined') return;
  const key = fiscalHintKey(hint);
  if (key !== state.key) publish({ ...state, key, hint });
}

export function fiscalRequestHeaders(
  url: string,
  baseUrl: string,
  headers?: HeadersInit,
  hint = state.hint,
) {
  if (!hint) return null;
  const base = new URL(
    baseUrl,
    typeof window === 'undefined' ? undefined : window.location?.origin,
  );
  const target = new URL(url, base);
  const prefix = base.pathname.replace(/\/$/, '');
  if (
    target.origin !== base.origin ||
    !target.pathname.startsWith(prefix + '/')
  )
    return null;
  const path = target.pathname.slice(prefix.length);
  if (
    !(
      path === '/finance' ||
      path.startsWith('/finance/') ||
      path === '/hr/payroll-finance' ||
      path.startsWith('/hr/payroll-finance/')
    ) ||
    path === '/finance/fiscal-context'
  )
    return null;
  const result = new Headers(headers);
  result.set('x-finance-company', hint.companySelection);
  if (hint.actorKey) result.set('x-finance-actor-id', hint.actorKey);
  result.set('x-finance-period-mode', hint.mode);
  if (hint.period) {
    result.set('x-finance-period-id', hint.period.id);
    result.set('x-finance-period-version', String(hint.period.version));
  } else {
    result.delete('x-finance-period-id');
    result.delete('x-finance-period-version');
  }
  return result;
}
export function beginFiscalWrite() {
  publish({ ...state, writing: state.writing + 1 });
  let finished = false;
  return () => {
    if (!finished) {
      finished = true;
      publish({ ...state, writing: Math.max(0, state.writing - 1) });
    }
  };
}
