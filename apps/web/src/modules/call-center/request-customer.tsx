'use client';
import { useRef, useState } from 'react';
import { useAccessActor } from '@/modules/iam/access-context';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { callCenterRequest } from './client';
import type { RequestCase } from './workflow-client';
export function RequestCustomer({
  branch,
  contact,
  request,
  onChanged,
}: {
  branch: string;
  contact: string;
  request: RequestCase;
  onChanged: () => void;
}) {
  const actor = useAccessActor();
  const [options, setOptions] = useState<
      { id: string; displayName: string; isActive: boolean }[]
    >([]),
    [customer, setCustomer] = useState(request.customerId ?? ''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  const retry = useRef<{ id: string; customer: string } | null>(null);
  if (!actor?.permissions.includes('customers.read'))
    return <p>مشاهده و اتصال مشتری نیازمند مجوز مشتریان است.</p>;
  async function lookup() {
    setBusy(true);
    setError('');
    try {
      const r = await callCenterRequest<{
        data: typeof options;
        meta: { hasMore: boolean };
      }>(`/contacts/${contact}/customer-candidates`, branch);
      setOptions(r.data);
      setLoaded(true);
      if (r.meta.hasMore)
        setError(
          'بیش از ۵۰ تطبیق وجود دارد؛ پرونده مشتری را در ماژول مشتریان بررسی کنید.',
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'دریافت مشتری انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError('');
    if (retry.current?.customer !== customer)
      retry.current = { id: crypto.randomUUID(), customer };
    try {
      await callCenterRequest(`/requests/${request.id}/customer`, branch, {
        method: 'POST',
        body: JSON.stringify({
          commandId: retry.current.id,
          expectedVersion: request.version,
          customerId: customer || null,
        }),
      });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ذخیره ارتباط انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>
        ارتباط با مشتری {request.customerId ? '· متصل' : '· تعیین نشده'}
      </summary>
      <p>
        شماره مشترک اثبات هویت نیست. هویت مشتری را بررسی و سپس انتخاب کنید؛ هیچ
        پرونده‌ای ادغام نمی‌شود.
      </p>
      <button disabled={busy} onClick={() => void lookup()}>
        بررسی مشتریان دارای این شماره
      </button>
      {loaded && !options.length && <p>مشتری مجازی با این شماره پیدا نشد.</p>}
      <NativeSearchSelect
        aria-label="مشتری درخواست"
        value={customer}
        disabled={busy}
        onChange={(e) => setCustomer(e.target.value)}
      >
        <option value="">بدون ارتباط</option>
        {request.customerId &&
          !options.some((o) => o.id === request.customerId) && (
            <option value={request.customerId}>مشتری مرتبط فعلی</option>
          )}
        {options.map((o) => (
          <option key={o.id} value={o.id} disabled={!o.isActive}>
            {o.displayName}
            {!o.isActive ? ' (غیرفعال)' : ''}
          </option>
        ))}
      </NativeSearchSelect>
      <button
        disabled={
          busy ||
          request.status === 'CLOSED' ||
          customer === (request.customerId ?? '') ||
          !actor.permissions.includes(
            'customer_affairs.call_center.workflow.manage',
          )
        }
        onClick={() => void save()}
      >
        ثبت ارتباط مشتری
      </button>
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
