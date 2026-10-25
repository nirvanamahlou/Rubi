'use client';
import { useEffect, useState } from 'react';
import {
  Download,
  Plus,
  Search,
  FilePenLine,
  History,
  ShieldCheck,
} from 'lucide-react';
import type {
  InsuranceDraftInputV1,
  InsurancePolicyRowV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/form-controls';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import {
  insuranceRequest,
  insuranceStatusLabels,
  type InsuranceCandidate,
  type InsuranceListResponse,
  type InsuranceSettingsResponse,
} from './client';
import styles from './workspace.module.css';
import { currencySymbol } from '@/lib/currency-symbol';

const emptyFilter = {
  search: '',
  status: 'ALL',
  destinationCode: '',
  dateBasis: 'CREATED',
  from: '',
  to: '',
};
export function InsurancePolicies({
  branches,
}: {
  branches: { id: string }[];
}) {
  const [filter, setFilter] = useState(emptyFilter);
  const [query, setQuery] = useState(emptyFilter);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<InsuranceListResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<InsuranceCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [countryNames, setCountryNames] = useState<Record<string, string>>({});
  const [planNames, setPlanNames] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    Promise.all(
      branches.map((branch) =>
        insuranceRequest<InsuranceSettingsResponse>(
          'settings?' + new URLSearchParams({ branchId: branch.id }),
        ),
      ),
    )
      .then((settings) => {
        if (!active) return;
        setCountryNames(
          Object.fromEntries(
            settings.flatMap((s) =>
              s.config.countries.map((c) => [
                c.providerCountryCode,
                c.providerCountryName,
              ]),
            ),
          ),
        );
        setPlanNames(
          Object.fromEntries(
            settings.flatMap((s, i) =>
              s.config.countries.flatMap((c) =>
                c.plans.map((p) => [
                  branches[i]!.id +
                    ':' +
                    c.providerCountryCode +
                    ':' +
                    p.providerPlanCode,
                  p.title,
                ]),
              ),
            ),
          ),
        );
      })
      .catch(() => {
        /* Stored provider codes remain visible if optional names cannot load. */
      });
    return () => {
      active = false;
    };
  }, [branches]);
  const [target, setTarget] = useState<
    InsuranceCandidate | InsurancePolicyRowV1 | null
  >(null);
  const [history, setHistory] = useState<
    { version: number; action: string; createdAt: string }[] | null
  >(null);
  useEffect(() => {
    let active = true;
    insuranceRequest<InsuranceListResponse>(
      'policies?' + new URLSearchParams({ ...query, page: String(page) }),
    )
      .then((r) => {
        if (active) setResult(r);
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setResult(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query, page, revision]);
  async function findCandidates() {
    setSearching(true);
    setError('');
    try {
      setCandidates(
        (
          await insuranceRequest<{ data: InsuranceCandidate[] }>(
            'candidates?' + new URLSearchParams({ search }),
          )
        ).data,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'جست‌وجو انجام نشد.');
    } finally {
      setSearching(false);
    }
  }
  async function showHistory(id: string) {
    try {
      setHistory(
        (
          await insuranceRequest<{
            data: { version: number; action: string; createdAt: string }[];
          }>('policies/' + id + '/history')
        ).data,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'سوابق دریافت نشد.');
    }
  }
  function exportPage() {
    const cells = [
      [
        'شماره قرارداد',
        'مسافر',
        'شماره بیمه‌نامه',
        'وضعیت',
        'کشور',
        'طرح',
        'تاریخ سفر',
        'مدت',
        'مبلغ',
        'ارز',
      ],
      ...(result?.data ?? []).map((r) => [
        r.contractNumber,
        r.passengerName,
        r.policyNumber ?? '',
        insuranceStatusLabels[r.status],
        r.destinationCode,
        r.planCode,
        r.departureDate,
        String(r.durationDays),
        r.amount ?? '',
        r.currencyCode ?? '',
      ]),
    ];
    const csv = cells
      .map((row) =>
        row
          .map(
            (cell) =>
              '"' +
              (/^[=+@\-\t\r]/.test(cell) ? "'" : '') +
              cell.replaceAll('"', '""') +
              '"',
          )
          .join(','),
      )
      .join('\r\n');
    const url = URL.createObjectURL(
      new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'insurance-policies-page.csv';
    link.click();
    URL.revokeObjectURL(url);
  }
  const statusCount = (status: string) =>
    result?.totals
      .filter((t) => t.status === status)
      .reduce((n, t) => n + t.count, 0) ?? 0;
  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <h2>مدیریت و اصلاح بیمه‌نامه‌ها</h2>
        <div className={styles.actions}>
          <Button
            variant="outline"
            onClick={exportPage}
            disabled={loading || !result?.data.length}
          >
            <Download size={16} />
            خروجی صفحه
          </Button>
          <Button
            disabled={!result?.canManage}
            onClick={() => {
              setAdding(true);
              setCandidates([]);
              setSearch('');
            }}
          >
            <Plus size={16} />
            درخواست بیمه
          </Button>
        </div>
      </div>
      <div className={styles.metrics}>
        {[
          ['بیمه‌نامه‌ها', result?.count ?? 0],
          ['صادرشده', statusCount('ISSUED')],
          ['پیش‌نویس', statusCount('DRAFT')],
          [
            'نیازمند بررسی',
            statusCount('INPUT_ERROR') + statusCount('PROVIDER_ERROR'),
          ],
        ].map(([label, count]) => (
          <div className={styles.card} key={label}>
            <span className={styles.muted}>{label}</span>
            <strong>{count}</strong>
          </div>
        ))}
      </div>
      <form
        className={styles.card}
        onSubmit={(e) => {
          e.preventDefault();
          setLoading(true);
          setError('');
          setQuery({ ...filter });
          setPage(1);
        }}
      >
        <div className={styles.filters}>
          <label>
            شماره قرارداد یا بیمه‌نامه
            <Input
              value={filter.search}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            />
          </label>
          <label>
            وضعیت
            <NativeSearchSelect
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            >
              <option value="ALL">همه موارد</option>
              {Object.entries(insuranceStatusLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </NativeSearchSelect>
          </label>
          <label>
            کشور
            <NativeSearchSelect
              value={filter.destinationCode}
              onChange={(e) =>
                setFilter({ ...filter, destinationCode: e.target.value })
              }
            >
              <option value="">همه کشورها</option>
              {Object.entries(countryNames).map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </NativeSearchSelect>
          </label>
          <label>
            مبنای تاریخ
            <NativeSearchSelect
              value={filter.dateBasis}
              onChange={(e) =>
                setFilter({ ...filter, dateBasis: e.target.value })
              }
            >
              <option value="CREATED">تاریخ ثبت</option>
              <option value="TRAVEL">تاریخ سفر</option>
              <option value="ISSUED">تاریخ صدور</option>
            </NativeSearchSelect>
          </label>
          <label>
            از تاریخ
            <DatePicker
              value={filter.from}
              onChange={(from) => setFilter({ ...filter, from })}
            />
          </label>
          <label>
            تا تاریخ
            <DatePicker
              value={filter.to}
              onChange={(to) => setFilter({ ...filter, to })}
            />
          </label>
          <Button type="submit" disabled={loading}>
            <Search size={16} />
            جست‌وجو
          </Button>
        </div>
      </form>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <section className={styles.card} aria-busy={loading}>
        {loading ? (
          <p>در حال دریافت بیمه‌نامه‌ها…</p>
        ) : !result?.data.length ? (
          <div className={styles.empty}>
            <ShieldCheck size={36} />
            <p>بیمه‌نامه‌ای با این فیلترها یافت نشد.</p>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={`${styles.table} ${styles.policyTable}`}>
              <thead>
                <tr>
                  {[
                    'شماره قرارداد',
                    'مسافر',
                    'شماره بیمه‌نامه',
                    'وضعیت',
                    'کشور / طرح',
                    'تاریخ سفر',
                    'مدت سفر',
                    'مبلغ بیمه‌نامه',
                    'تاریخ صدور',
                    'عملیات',
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.data.map((row) => (
                  <tr key={row.id}>
                    <td dir="ltr">{row.contractNumber}</td>
                    <td>{row.passengerName}</td>
                    <td dir="ltr">{row.policyNumber ?? ''}</td>
                    <td>
                      <span
                        className={
                          row.status === 'ISSUED'
                            ? styles.goodBadge
                            : styles.badge
                        }
                      >
                        {insuranceStatusLabels[row.status]}
                      </span>
                    </td>
                    <td>
                      {countryNames[row.destinationCode] ?? row.destinationCode}
                      <small>
                        {planNames[
                          row.branchId +
                            ':' +
                            row.destinationCode +
                            ':' +
                            row.planCode
                        ] ?? row.planCode}
                      </small>
                    </td>
                    <td dir="ltr">{row.departureDate}</td>
                    <td>{row.durationDays} روز</td>
                    <td dir="ltr">
                      {row.amount === null
                        ? '—'
                        : row.amount +
                          ' ' +
                          currencySymbol(row.currencyCode ?? '')}
                    </td>
                    <td dir="ltr">{row.issuedAt?.slice(0, 10) ?? '—'}</td>
                    <td>
                      <div className={styles.actions}>
                        <Button
                          variant="outline"
                          disabled={
                            !result.canManage ||
                            ![
                              'DRAFT',
                              'INPUT_ERROR',
                              'PROVIDER_ERROR',
                            ].includes(row.status)
                          }
                          onClick={() => setTarget(row)}
                        >
                          <FilePenLine size={15} />
                          اصلاح
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => void showHistory(row.id)}
                        >
                          <History size={15} />
                          سوابق
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className={styles.toolbar}>
          <span className={styles.muted}>جمع مبلغ بیمه‌نامه‌های صادرشده</span>
          <div className={styles.actions}>
            {result?.totals
              .filter((t) => t.status === 'ISSUED' && t.amount !== null)
              .map((t) => (
                <strong dir="ltr" key={t.currencyCode}>
                  {t.amount} {currencySymbol(t.currencyCode ?? '')}
                </strong>
              ))}
          </div>
        </div>
        <div className={styles.toolbar}>
          <span className={styles.muted}>{result?.count ?? 0} مورد</span>
          <div className={styles.actions}>
            <Button
              variant="outline"
              disabled={loading || page <= 1}
              onClick={() => {
                setLoading(true);
                setPage(page - 1);
              }}
            >
              قبلی
            </Button>
            <span>{page}</span>
            <Button
              variant="outline"
              disabled={loading || page * 50 >= (result?.count ?? 0)}
              onClick={() => {
                setLoading(true);
                setPage(page + 1);
              }}
            >
              بعدی
            </Button>
          </div>
        </div>
      </section>
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogTitle>آماده‌سازی درخواست بیمه</DialogTitle>
          <DialogDescription>
            مسافرانی که بیمه در قراردادشان انتخاب شده است.
          </DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void findCandidates();
            }}
            className={styles.actions}
          >
            <Input
              aria-label="جست‌وجوی شماره قرارداد بیمه"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="شماره قرارداد"
            />
            <Button
              type="submit"
              disabled={searching || search.trim().length < 2}
            >
              جست‌وجو
            </Button>
          </form>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <div className={styles.countryList}>
            {candidates.map((c) => (
              <button
                key={c.intakeId + c.customerId}
                type="button"
                onClick={() => {
                  setAdding(false);
                  setTarget(c);
                }}
              >
                <span>{c.passengerName}</span>
                <span dir="ltr">{c.contractNumber}</span>
              </button>
            ))}
          </div>
          {!searching && search.length >= 2 && !candidates.length && (
            <p className={styles.muted}>
              نتیجه‌ای برای افزودن نمایش داده نشده است.
            </p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(target)}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
      >
        <DialogContent>
          <DialogTitle>درخواست بیمه مسافر</DialogTitle>
          <DialogDescription>
            {target?.passengerName} · {target?.contractNumber}
          </DialogDescription>
          {target && (
            <InsuranceDraft
              key={target.customerId + target.intakeId}
              target={target}
              saved={() => {
                setTarget(null);
                setLoading(true);
                setRevision((n) => n + 1);
                window.dispatchEvent(new Event('reservation-workflow-changed'));
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={history !== null}
        onOpenChange={(open) => {
          if (!open) setHistory(null);
        }}
      >
        <DialogContent>
          <DialogTitle>سوابق بیمه‌نامه</DialogTitle>
          <DialogDescription>نسخه‌های ثبت‌شده درخواست بیمه</DialogDescription>
          <ol className={styles.stack}>
            {history?.map((h) => (
              <li key={h.version}>
                نسخه {h.version} ·{' '}
                {h.action === 'DRAFT_SAVED'
                  ? 'ذخیره پیش‌نویس'
                  : h.action === 'PROVIDER_CONFIRMED'
                    ? 'تأیید صدور بیمه‌گر'
                    : h.action}{' '}
                ·{' '}
                <span dir="ltr">
                  {h.createdAt.slice(0, 16).replace('T', ' ')}
                </span>
              </li>
            ))}
          </ol>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InsuranceDraft({
  target,
  saved,
}: {
  target: InsuranceCandidate | InsurancePolicyRowV1;
  saved: () => void;
}) {
  const previous = 'version' in target ? target : null;
  const [settings, setSettings] = useState<InsuranceSettingsResponse | null>(
    null,
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<InsuranceDraftInputV1>({
    intakeId: target.intakeId,
    customerId: target.customerId,
    destinationCode: previous?.destinationCode ?? '',
    planCode: previous?.planCode ?? '',
    departureDate: previous?.departureDate ?? '',
    durationDays: previous?.durationDays ?? 7,
    notes: previous?.notes ?? '',
    expectedVersion: previous?.version ?? 0,
  });
  useEffect(() => {
    let active = true;
    insuranceRequest<InsuranceSettingsResponse>(
      'settings?' + new URLSearchParams({ branchId: target.branchId }),
    )
      .then((r) => {
        if (active) setSettings(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [target.branchId]);
  const country = settings?.config.countries.find(
    (c) => c.providerCountryCode === draft.destinationCode,
  );
  async function save() {
    setBusy(true);
    setError('');
    try {
      await insuranceRequest('draft', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(draft),
      });
      saved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ذخیره انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className={styles.stack}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <div className={styles.fields}>
        <label>
          کشور
          <NativeSearchSelect
            required
            value={draft.destinationCode}
            disabled={busy}
            onChange={(e) =>
              setDraft({
                ...draft,
                destinationCode: e.target.value,
                planCode: '',
              })
            }
          >
            <option value="">انتخاب کشور</option>
            {settings?.config.countries
              .filter((c) => c.active)
              .map((c) => (
                <option key={c.countryId} value={c.providerCountryCode}>
                  {c.providerCountryName}
                </option>
              ))}
          </NativeSearchSelect>
        </label>
        <label>
          طرح بیمه
          <NativeSearchSelect
            required
            value={draft.planCode}
            disabled={busy}
            onChange={(e) => setDraft({ ...draft, planCode: e.target.value })}
          >
            <option value="">انتخاب طرح</option>
            {country?.plans.map((p) => (
              <option key={p.providerPlanCode} value={p.providerPlanCode}>
                {p.title}
              </option>
            ))}
          </NativeSearchSelect>
        </label>
        <label>
          تاریخ سفر
          <DatePicker
            value={draft.departureDate}
            onChange={(departureDate) => setDraft({ ...draft, departureDate })}
            disabled={busy}
          />
        </label>
        <label>
          مدت سفر (روز)
          <Input
            type="number"
            required
            min={1}
            max={365}
            value={draft.durationDays}
            disabled={busy}
            onChange={(e) =>
              setDraft({ ...draft, durationDays: Number(e.target.value) })
            }
          />
        </label>
      </div>
      <label>
        یادداشت
        <Textarea
          maxLength={2000}
          value={draft.notes}
          disabled={busy}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        />
      </label>
      <Button
        type="submit"
        disabled={busy || !settings || !draft.departureDate || !draft.planCode}
      >
        ذخیره پیش‌نویس
      </Button>
    </form>
  );
}
