'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  B2B_DOSSIER_SECTIONS,
  type B2bOrganizationUser,
  type B2bOrganizationUserInput,
} from '@rubi/contracts';
import { Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/form-controls';
import { agencyClient, B2bApiError } from '../api/agency-client';
import { useDossierBranch } from './use-dossier-branch';
import { DossierFormDialog } from './dossier-form-dialog';
import { DossierDateFilters } from './dossier-date-filters';
import { inDossierDateRange } from '../model/dossier-date-range';
type Draft = B2bOrganizationUserInput & {
  displayName: string;
  username: string;
  password: string;
};
export function OrganizationUsersPanel({
  organizationId,
  view = 'users',
}: {
  organizationId: string;
  view?: string;
}) {
  const { branchId, permissions } = useDossierBranch();
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [rows, setRows] = useState<B2bOrganizationUser[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [reload, setReload] = useState(0);
  const [editor, setEditor] = useState<{ id?: string; draft: Draft }>();
  const [history, setHistory] = useState<
    { id: string; action: string; occurredAt: string }[]
  >([]);
  const refresh = useCallback(() => setReload((n) => n + 1), []);
  useEffect(() => {
    let active = true;
    if (!branchId) return;
    void agencyClient
      .organizationUsers(organizationId, branchId)
      .then((r) => {
        if (active) {
          setRows(r.data);
          setError('');
        }
      })
      .catch((e) => {
        if (active) {
          setError(
            e instanceof Error ? e.message : 'دریافت کاربران ناموفق بود.',
          );
          setRows([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [organizationId, branchId, reload]);
  useEffect(() => {
    let active = true;
    if (view !== 'history' || !branchId) return;
    void agencyClient
      .organizationUserHistory(organizationId, branchId)
      .then((r) => {
        if (active) setHistory(r.data);
      })
      .catch(() => {
        if (active) setError('دریافت تاریخچه دسترسی ناموفق بود.');
      });
    return () => {
      active = false;
    };
  }, [view, organizationId, branchId, reload]);
  const canManage = permissions.includes('b2b.agency.manage');
  const set = (patch: Partial<Draft>) =>
    setEditor((e) => (e ? { ...e, draft: { ...e.draft, ...patch } } : e));
  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2 className="panel-title">
            <Users size={18} />
            کاربران و دسترسی‌های پرونده
          </h2>
          <p className="panel-note">
            هر کاربر فقط بخش‌های انتخاب‌شده از پرونده همین آژانس را مشاهده
            می‌کند.
          </p>
        </div>
        <Button
          disabled={!canManage || !branchId}
          onClick={() =>
            setEditor({
              draft: {
                branchId,
                roleName: 'کارشناس آژانس',
                sections: ['organization'],
                isActive: true,
                reason: 'ثبت کاربر جدید سازمان',
                displayName: '',
                username: '',
                password: '',
              },
            })
          }
        >
          <Plus size={16} />
          افزودن کاربر
        </Button>
      </header>
      <div className="panel-body space-y-4">
        <div className="dossier-filter-grid">
          <DossierDateFilters
            value={dateRange}
            onChange={setDateRange}
            basis={view === 'history' ? 'فعالیت' : 'آخرین تغییر کاربر'}
          />
        </div>
        <p className="panel-note">
          ورود کاربران:{' '}
          <a
            className="underline"
            href="/login?next=%2Fagency-portal"
            target="_blank"
            rel="noreferrer"
          >
            پرتال پرونده آژانس
          </a>{' '}
          · دسترسی مشاهده با مجوز ثبت، تأیید قرارداد یا تغییر اعتبار متفاوت است.
        </p>
        {error ? (
          <p role="alert" className="form-error">
            {error}
          </p>
        ) : null}
        {loading ? (
          <p>در حال دریافت کاربران…</p>
        ) : !rows.length ? (
          <p>هنوز کاربری ثبت نشده است؛ از «افزودن کاربر» استفاده کنید.</p>
        ) : null}
        {view === 'history' ? (
          <div className="space-y-2">
            {history
              .filter((event) =>
                inDossierDateRange(event.occurredAt, dateRange),
              )
              .map((event) => (
                <p className="rounded-xl border p-3" key={event.id}>
                  {event.action.endsWith('create')
                    ? 'ثبت کاربر'
                    : 'تغییر دسترسی'}{' '}
                  · {new Date(event.occurredAt).toLocaleString('fa-IR')}
                </p>
              ))}
          </div>
        ) : null}
        <div className="grid gap-3">
          {rows
            .filter(
              (row) =>
                view !== 'history' &&
                inDossierDateRange(row.updatedAt, dateRange),
            )
            .map((row) => (
              <article key={row.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <strong>{row.displayName}</strong>
                    <p className="panel-note">
                      <span dir="ltr">{row.username}</span> ·{' '}
                      {row.isActive && row.accountStatus === 'ACTIVE'
                        ? 'فعال'
                        : 'غیرفعال'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    disabled={!canManage}
                    onClick={() =>
                      setEditor({
                        id: row.id,
                        draft: {
                          branchId: row.branchId,
                          roleName: row.roleName,
                          sections: row.sections,
                          isActive: row.isActive,
                          version: row.version,
                          reason: '',
                          displayName: row.displayName,
                          username: row.username,
                          password: '',
                        },
                      })
                    }
                  >
                    ویرایش دسترسی
                  </Button>
                </div>
                <p className="mt-3 text-sm">نقش سازمانی: {row.roleName}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-sm">بخش‌های مجاز:</span>
                  {B2B_DOSSIER_SECTIONS.filter((s) =>
                    row.sections.includes(s.id),
                  ).map((s) => (
                    <span className="badge blue" key={s.id}>
                      {s.label}
                    </span>
                  ))}
                  {!row.sections.length ? <span>بدون دسترسی</span> : null}
                </div>
                {view === 'history' ? (
                  <p className="panel-note mt-3">
                    آخرین تغییر:{' '}
                    {new Date(row.updatedAt).toLocaleString('fa-IR')} · نسخه{' '}
                    {row.version.toLocaleString('fa-IR')}
                  </p>
                ) : null}
              </article>
            ))}
        </div>
        <Button variant="outline" onClick={refresh}>
          تازه‌سازی کاربران
        </Button>
      </div>
      {editor ? (
        <DossierFormDialog
          title={editor.id ? 'ویرایش دسترسی کاربر' : 'افزودن کاربر آژانس'}
          description="حساب ورود فقط برای پرونده همین آژانس است. بخش‌های مجاز را انتخاب کنید."
          onClose={() => {
            setEditor(undefined);
            refresh();
          }}
          onSave={async () => {
            const d = editor.draft;
            if (d.isActive && !d.sections.length)
              throw new B2bApiError(
                'برای کاربر فعال حداقل یک بخش انتخاب کنید.',
                400,
              );
            const { displayName, username, password, ...access } = d;
            await agencyClient.saveOrganizationUser(
              organizationId,
              editor.id
                ? access
                : { ...access, displayName, username, password },
              editor.id,
            );
            refresh();
          }}
        >
          <label className="field">
            نام و نام خانوادگی
            <Input
              required
              minLength={2}
              maxLength={160}
              disabled={Boolean(editor.id)}
              value={editor.draft.displayName}
              onChange={(e) => set({ displayName: e.target.value })}
            />
          </label>
          <label className="field">
            نام کاربری
            <Input
              required
              dir="ltr"
              pattern="[a-zA-Z0-9._-]{3,80}"
              autoComplete="off"
              disabled={Boolean(editor.id)}
              value={editor.draft.username}
              onChange={(e) => set({ username: e.target.value })}
            />
          </label>
          {!editor.id ? (
            <label className="field sm:col-span-2">
              رمز اولیه
              <Input
                type="password"
                required
                minLength={10}
                maxLength={200}
                autoComplete="new-password"
                value={editor.draft.password}
                onChange={(e) => set({ password: e.target.value })}
              />
              <span className="panel-note">
                حداقل ۱۰ نویسه شامل حرف کوچک و بزرگ لاتین، عدد و علامت.
              </span>
            </label>
          ) : null}
          <label className="field">
            نقش سازمانی
            <Input
              required
              minLength={2}
              maxLength={120}
              value={editor.draft.roleName}
              onChange={(e) => set({ roleName: e.target.value })}
            />
          </label>
          <label className="field">
            وضعیت دسترسی
            <select
              className="input"
              value={editor.draft.isActive ? 'active' : 'inactive'}
              onChange={(e) => set({ isActive: e.target.value === 'active' })}
            >
              <option value="active">فعال</option>
              <option value="inactive">غیرفعال</option>
            </select>
          </label>
          <fieldset className="sm:col-span-2">
            <legend className="mb-3 font-bold">
              بخش‌های قابل مشاهده در پرونده همین آژانس
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {B2B_DOSSIER_SECTIONS.map((s) => (
                <label
                  className="flex items-center gap-2 rounded-xl border p-3"
                  key={s.id}
                >
                  <input
                    type="checkbox"
                    checked={editor.draft.sections.includes(s.id)}
                    onChange={(e) =>
                      set({
                        sections: e.target.checked
                          ? [...editor.draft.sections, s.id]
                          : editor.draft.sections.filter((id) => id !== s.id),
                      })
                    }
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="field sm:col-span-2">
            دلیل ثبت یا تغییر دسترسی
            <Textarea
              required
              minLength={5}
              maxLength={500}
              value={editor.draft.reason}
              onChange={(e) => set({ reason: e.target.value })}
            />
          </label>
        </DossierFormDialog>
      ) : null}
    </section>
  );
}
