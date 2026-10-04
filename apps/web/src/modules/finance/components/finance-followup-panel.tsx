'use client';
import { useEffect, useRef, useState } from 'react';
import type { FinanceInboxQueryV1 } from '@nora/contracts';
import { useAccessPermissions } from '@/modules/iam/access-context';
import { Input } from '@/components/ui/form-controls';
import { Button } from '@/components/ui/button';
import { apiRequest } from '../api/finance-inbox-api';

type View = { id: string; title: string; query: FinanceInboxQueryV1 };
type Policy = {
  policy: { managerId: string; version: number } | null;
  candidates: { id: string; displayName: string }[];
};
export function FinanceFollowupPanel({
  query,
  onApply,
}: {
  query: FinanceInboxQueryV1;
  onApply: (query: FinanceInboxQueryV1) => void;
}) {
  const permissions = useAccessPermissions();
  const [views, setViews] = useState<View[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [title, setTitle] = useState('');
  const [selected, setSelected] = useState('');
  const [branchId, setBranchId] = useState('');
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [managerId, setManagerId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const mutation = useRef(false);
  useEffect(() => {
    let active = true;
    void Promise.all([
      apiRequest<View[]>('/finance/followup/views'),
      apiRequest<{ id: string; name: string }[]>('/finance/followup/branches'),
    ])
      .then(([saved, available]) => {
        if (active) {
          setViews(saved);
          setBranches(available);
        }
      })
      .catch((error) => {
        if (active)
          setMessage(
            error instanceof Error
              ? error.message
              : 'دریافت تنظیمات ناموفق بود.',
          );
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!branchId || !permissions?.includes('finance.account.manage')) return;
    let active = true;
    void apiRequest<Policy>(
      `/finance/followup/policy?branchId=${encodeURIComponent(branchId)}`,
    )
      .then((value) => {
        if (active) {
          setPolicy(value);
          setManagerId(value.policy?.managerId ?? '');
        }
      })
      .catch((error) => {
        if (active)
          setMessage(
            error instanceof Error ? error.message : 'دریافت مدیر ناموفق بود.',
          );
      });
    return () => {
      active = false;
    };
  }, [branchId, permissions]);
  async function run(operation: () => Promise<void>) {
    if (mutation.current) return;
    mutation.current = true;
    setBusy(true);
    setMessage('');
    try {
      await operation();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'ثبت تنظیمات ناموفق بود.',
      );
    } finally {
      mutation.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="space-y-3 rounded-xl border p-3"
      aria-label="نمای شخصی و پیگیری مالی"
    >
      <div className="flex flex-wrap items-end gap-2">
        <label>
          نمای ذخیره‌شده
          <select
            className="block rounded border p-2"
            value={selected}
            disabled={busy}
            onChange={(event) => {
              setSelected(event.target.value);
              const view = views.find((item) => item.id === event.target.value);
              if (view) onApply(view.query);
            }}
          >
            <option value="">انتخاب نمای شخصی</option>
            {views.map((view) => (
              <option key={view.id} value={view.id}>
                {view.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          نام نمای جدید
          <Input
            value={title}
            maxLength={80}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <Button
          disabled={busy || !title.trim()}
          onClick={() =>
            void run(async () => {
              const filters = Object.fromEntries(
                Object.entries(query).filter(
                  ([key]) => !['page', 'pageSize'].includes(key),
                ),
              );
              const saved = await apiRequest<View>('/finance/followup/views', {
                method: 'POST',
                body: JSON.stringify({
                  title,
                  query: JSON.parse(JSON.stringify(filters)),
                }),
              });
              setViews((values) => [
                ...values.filter((view) => view.id !== saved.id),
                saved,
              ]);
              setSelected(saved.id);
              setMessage('نمای شخصی ذخیره شد.');
            })
          }
        >
          ذخیره فیلترها
        </Button>
        <Button
          variant="outline"
          disabled={busy || !selected}
          onClick={() =>
            void run(async () => {
              await apiRequest(`/finance/followup/views/${selected}/remove`, {
                method: 'POST',
              });
              setViews((values) =>
                values.filter((view) => view.id !== selected),
              );
              setSelected('');
              setMessage('نمای شخصی حذف شد.');
            })
          }
        >
          حذف نمای انتخاب‌شده
        </Button>
        <label>
          شعبه
          <select
            className="block rounded border p-2"
            value={query.branchId ?? ''}
            disabled={busy}
            onChange={(event) =>
              onApply({ ...query, branchId: event.target.value })
            }
          >
            <option value="">همه شعبه‌های مجاز</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {permissions?.includes('finance.account.manage') ? (
        <details>
          <summary>مدیر پیگیری هر شعبه</summary>
          <p>
            درخواست‌های باز کارتابل مالی: یادآوری یک روز قبل؛ ارجاع به مدیر یک
            روز بعد از سررسید. مدیر باید مجوز مشاهده مالی همان شعبه را داشته
            باشد.
          </p>
          <label>
            شعبه تنظیمات
            <select
              className="block rounded border p-2"
              value={branchId}
              disabled={busy}
              onChange={(event) => {
                setPolicy(null);
                setManagerId('');
                setBranchId(event.target.value);
              }}
            >
              <option value="">انتخاب شعبه</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            مدیر شعبه
            <select
              className="block rounded border p-2"
              value={managerId}
              disabled={busy || !policy}
              onChange={(event) => setManagerId(event.target.value)}
            >
              <option value="">انتخاب مدیر مجاز</option>
              {policy?.candidates.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName}
                </option>
              ))}
            </select>
          </label>
          <Button
            disabled={busy || !branchId || !managerId || !policy}
            onClick={() =>
              void run(async () => {
                await apiRequest('/finance/followup/policy', {
                  method: 'POST',
                  body: JSON.stringify({
                    branchId,
                    managerId,
                    expectedVersion: policy?.policy?.version ?? 0,
                  }),
                });
                setPolicy(
                  await apiRequest<Policy>(
                    `/finance/followup/policy?branchId=${encodeURIComponent(branchId)}`,
                  ),
                );
                setMessage('مدیر پیگیری شعبه ذخیره شد.');
              })
            }
          >
            ذخیره مدیر پیگیری
          </Button>
        </details>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
