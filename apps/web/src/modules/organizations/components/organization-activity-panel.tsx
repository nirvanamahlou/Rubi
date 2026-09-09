'use client';
import { useEffect, useMemo, useState } from 'react';
import type {
  OrganizationActivityEvent,
  OrganizationActivityPage,
  OrganizationActivityQuery,
} from '@rubi/contracts';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import { agencyClient } from '../api/agency-client';
import {
  activityAction,
  activityCategories,
  activityDate,
  activitySources,
  activityWorkbook,
  loadActivityReport,
} from '../model/activity-report';
import { useDossierBranch } from './use-dossier-branch';

export function OrganizationActivityPanel({
  organizationId,
  tab,
}: {
  organizationId: string;
  tab: string;
}) {
  const { branchId, setBranchId, branches, sessionError } = useDossierBranch();
  const [filter, setFilter] = useState<OrganizationActivityQuery>({});
  const [result, setResult] = useState<{
    key: string;
    report?: OrganizationActivityPage;
    error?: string;
  }>();
  const [exportFailure, setExportFailure] = useState<{
    key: string;
    message: string;
  }>();
  const [received, setReceived] = useState<{ key: string; count: number }>();
  const [reload, setReload] = useState(0);
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<OrganizationActivityEvent>();
  const invalidRange = Boolean(
    filter.from && filter.to && filter.from > filter.to,
  );
  const scopeKey = JSON.stringify([organizationId, branchId, filter, reload]);
  const report = result?.key === scopeKey ? result.report : undefined;
  const error =
    (result?.key === scopeKey ? result.error : '') ||
    (exportFailure?.key === scopeKey ? exportFailure.message : '');
  const loading = Boolean(
    branchId && !invalidRange && result?.key !== scopeKey,
  );
  const progress = received?.key === scopeKey ? received.count : 0;
  useEffect(() => {
    const controller = new AbortController();
    if (!branchId || invalidRange) return;
    void loadActivityReport(
      (query) =>
        agencyClient.activity(
          organizationId,
          branchId,
          query,
          controller.signal,
        ),
      filter,
      (count) => {
        if (!controller.signal.aborted) setReceived({ key: scopeKey, count });
      },
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult({ key: scopeKey, report: data });
          setPage(0);
          setDetail(undefined);
        }
      })
      .catch((caught) => {
        if (!controller.signal.aborted)
          setResult({
            key: scopeKey,
            error:
              caught instanceof Error
                ? caught.message
                : 'دریافت گزارش ناموفق بود.',
          });
      });
    return () => controller.abort();
  }, [organizationId, branchId, filter, invalidRange, scopeKey]);
  const rows = report?.data ?? [];
  const counts = useMemo(
    () =>
      Object.entries(activityCategories).map(([key, title]) => ({
        key,
        title,
        count: report?.data.filter((row) => row.category === key).length ?? 0,
      })),
    [report],
  );
  const exportReport = async () => {
    try {
      const { downloadOrganizationXlsx } =
        await import('../model/organization-xlsx');
      downloadOrganizationXlsx(`rubi-dossier-activity-${organizationId}.xlsx`, [
        [
          'گزارش فعالیت پرونده',
          organizationId,
          'شعبه',
          branches.find((b) => b.id === branchId)?.name ?? branchId,
        ],
        [
          'از',
          filter.from ?? 'ابتدا',
          'تا',
          filter.to ?? 'اکنون',
          'زمان تهیه UTC',
          report?.asOf ?? '',
        ],
        ...activityWorkbook(rows),
      ]);
    } catch {
      setExportFailure({
        key: scopeKey,
        message: 'تهیه خروجی اکسل ناموفق بود.',
      });
    }
  };
  return (
    <section className="panel" aria-label="گزارش فعالیت پرونده">
      <header className="panel-head">
        <div>
          <h2 className="panel-title">
            {tab === 'audit'
              ? 'تاریخچه فعالیت‌ها'
              : tab === 'export'
                ? 'خروجی گزارش فعالیت‌ها'
                : 'گزارش فعالیت پرونده'}
          </h2>
          <p className="hint">
            سوابق ثبت‌شده در سامانه؛ تاریخ‌ها بر اساس ساعت تهران هستند.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={loading || !branchId}
            onClick={() => setReload((n) => n + 1)}
          >
            تازه‌سازی
          </Button>
          <Button
            disabled={loading || !report || !rows.length}
            onClick={() => void exportReport()}
          >
            خروجی Excel ({rows.length.toLocaleString('fa-IR')})
          </Button>
        </div>
      </header>
      <div className="panel-body space-y-4">
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <label className="field">
            <span>شعبه همکاری روبی</span>
            <select
              className="input"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>بخش</span>
            <select
              className="input"
              value={filter.category ?? ''}
              onChange={(e) =>
                setFilter({
                  ...filter,
                  category: e.target
                    .value as OrganizationActivityQuery['category'],
                })
              }
            >
              <option value="">همه بخش‌ها</option>
              {Object.entries(activityCategories).map(([key, title]) => (
                <option key={key} value={key}>
                  {title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>منبع</span>
            <select
              className="input"
              value={filter.source ?? ''}
              onChange={(e) =>
                setFilter({
                  ...filter,
                  source: e.target.value as OrganizationActivityQuery['source'],
                })
              }
            >
              <option value="">همه منابع مجاز</option>
              {Object.entries(activitySources).map(([key, title]) => (
                <option key={key} value={key}>
                  {title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>نتیجه</span>
            <select
              className="input"
              value={filter.outcome ?? ''}
              onChange={(e) =>
                setFilter({ ...filter, outcome: e.target.value })
              }
            >
              <option value="">همه نتایج</option>
              <option value="SUCCESS">موفق</option>
              <option value="FAILURE">ناموفق</option>
            </select>
          </label>
          <div className="field">
            <span>از تاریخ</span>
            <DatePicker
              withinDialog
              aria-label="از تاریخ گزارش"
              value={filter.from ?? ''}
              onChange={(from) => setFilter({ ...filter, from })}
            />
          </div>
          <div className="field">
            <span>تا تاریخ</span>
            <DatePicker
              withinDialog
              aria-label="تا تاریخ گزارش"
              value={filter.to ?? ''}
              onChange={(to) => setFilter({ ...filter, to })}
            />
          </div>
        </div>
        <Button variant="outline" onClick={() => setFilter({})}>
          پاک‌کردن فیلترها
        </Button>
        {(error || sessionError || invalidRange) && (
          <p role="alert" className="form-error">
            {error || sessionError || 'تاریخ پایان نباید قبل از شروع باشد.'}
          </p>
        )}
        <p className="hint">
          تغییر تضمین و سقف اعتبار همراه نسخه قرارداد ثبت می‌شود. عملیات مالی
          این پرونده فعلاً نمایشی است و در سوابق واقعی محسوب نمی‌شود. این گزارش
          شامل رویدادهای ذخیره‌شده است؛ کلیک‌ها و تلاش‌هایی که در منبع لاگ
          نشده‌اند قابل بازسازی نیستند.
        </p>
        {!!report?.unavailableSources.length && (
          <div role="status" className="notice">
            {report.unavailableSources.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        )}
        {loading ? (
          <p role="status">
            در حال دریافت گزارش… {progress.toLocaleString('fa-IR')} رویداد
          </p>
        ) : report ? (
          <>
            <div className="flex flex-wrap justify-between gap-2">
              <strong>
                {rows.length.toLocaleString('fa-IR')} فعالیت در محدوده
                انتخاب‌شده
              </strong>
              <span className="hint">تا {activityDate(report.asOf)}</span>
            </div>
            {tab === 'reports' && (
              <div className="grid gap-3 md:grid-cols-3">
                {counts.map((item) => (
                  <button
                    key={item.key}
                    className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 text-right"
                    onClick={() =>
                      setFilter({
                        ...filter,
                        category:
                          item.key as OrganizationActivityQuery['category'],
                      })
                    }
                  >
                    <span>{item.title}</span>
                    <strong className="mt-2 block text-xl">
                      {item.count.toLocaleString('fa-IR')}
                    </strong>
                  </button>
                ))}
              </div>
            )}
            {tab === 'export' && (
              <p className="notice">
                خروجی اکسل شامل تمام {rows.length.toLocaleString('fa-IR')}{' '}
                رویدادِ فیلترشده است، همراه زمان، انجام‌دهنده، نتیجه و فیلدهای
                تغییرکرده.
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>زمان</th>
                    <th>بخش و فعالیت</th>
                    <th>انجام‌دهنده</th>
                    <th>نتیجه</th>
                    <th>جزئیات</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(page * 50, (page + 1) * 50).map((row) => (
                    <tr key={row.id}>
                      <td>{activityDate(row.occurredAt)}</td>
                      <td>
                        <strong>{activityAction(row)}</strong>
                        <small className="block">
                          {activityCategories[row.category]}
                        </small>
                      </td>
                      <td>{row.actorName}</td>
                      <td>{row.outcome === 'SUCCESS' ? 'موفق' : 'ناموفق'}</td>
                      <td>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDetail(row)}
                        >
                          مشاهده جزئیات
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && (
              <p className="hint">
                در این محدوده، فعالیت ثبت‌شده‌ای وجود ندارد.
              </p>
            )}
            {rows.length > 50 && (
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  disabled={!page}
                  onClick={() => setPage((n) => n - 1)}
                >
                  قبلی
                </Button>
                <span>
                  صفحه {(page + 1).toLocaleString('fa-IR')} از{' '}
                  {Math.ceil(rows.length / 50).toLocaleString('fa-IR')}
                </span>
                <Button
                  variant="outline"
                  disabled={(page + 1) * 50 >= rows.length}
                  onClick={() => setPage((n) => n + 1)}
                >
                  بعدی
                </Button>
              </div>
            )}
          </>
        ) : null}
      </div>
      <Dialog
        open={!!detail && !!report}
        onOpenChange={(open) => {
          if (!open) setDetail(undefined);
        }}
      >
        <DialogContent dir="rtl" className="b2b-design b2b-modal">
          <DialogTitle>جزئیات فعالیت</DialogTitle>
          <DialogDescription>
            اطلاعات رویداد ثبت‌شده در پرونده
          </DialogDescription>
          {detail && (
            <dl className="space-y-3">
              <dt>فعالیت</dt>
              <dd>
                {activityAction(detail)} — {activityCategories[detail.category]}
              </dd>
              <dt>زمان و انجام‌دهنده</dt>
              <dd>
                {activityDate(detail.occurredAt)} — {detail.actorName}
              </dd>
              <dt>فیلدهای تغییرکرده</dt>
              <dd>
                {detail.changedFields.join('، ') ||
                  'نام فیلدها در این رویداد ثبت نشده یا عملیات از نوع مشاهده است.'}
              </dd>
              <dt>منبع</dt>
              <dd>{activitySources[detail.source]}</dd>
              <dt>کد رویداد</dt>
              <dd dir="ltr" className="break-all">
                {detail.action}
              </dd>
              <dt>شناسه رکورد</dt>
              <dd dir="ltr" className="break-all">
                {detail.entityId}
              </dd>
              <dt>شناسه رویداد</dt>
              <dd dir="ltr" className="break-all">
                {detail.id}
              </dd>
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
