'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  B2bAgreementCaseV1,
  B2bAgreementRevisionV1,
  B2bAgreementTermsV1,
  B2bCooperationRole,
  BranchReference,
  IamPermissionCode,
} from '@rubi/contracts';
import { b2bAgreementTermsIssue } from '@rubi/contracts';
import {
  Plus,
  RefreshCw,
  FileText,
  History,
  Send,
  Pencil,
  ShieldCheck,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/overlays';
import { agencyClient, B2bApiError } from '../api/agency-client';
import {
  blankAgreementTerms,
  editableAgreementTerms,
  reviewLabels,
  serviceLabels,
} from '../model/agreement-terms';
import { AgreementTermsEditor } from './agreement-terms-editor';

function RevisionSummary({ revision }: { revision: B2bAgreementRevisionV1 }) {
  return (
    <div className="agreement-summary">
      <div className="summary-list">
        {[
          ['عنوان', revision.title],
          [
            'نوع قرارداد',
            {
              FRAMEWORK: 'چارچوب',
              AGENCY: 'آژانس',
              CORPORATE: 'مشتری سازمانی',
            }[revision.agreementType],
          ],
          [
            'اعتبار زمانی',
            `${revision.startsAt} تا ${revision.endsAt ?? 'بدون پایان'}`,
          ],
          ['ارزها', revision.currencyCodes.join('، ')],
          ['خدمات', revision.services.map((s) => serviceLabels[s]).join('، ')],
          [
            'پرداخت',
            { PREPAID: 'پیش‌پرداخت', CREDIT: 'اعتباری', MIXED: 'ترکیبی' }[
              revision.paymentMethod
            ],
          ],
          [
            'تسویه',
            `${{ PER_ORDER: 'هر سفارش', WEEKLY: 'هفتگی', MONTHLY: 'ماهانه', CUSTOM: 'تعداد روز مشخص' }[revision.settlementCycle]}، مهلت ${revision.settlementDays} روز${revision.cutoffDay ? `، روز بستن حساب ${revision.cutoffDay}` : ''}`,
          ],
          [
            'مهلت پاسخ‌گویی',
            revision.slaHours ? `${revision.slaHours} ساعت` : 'تعیین نشده',
          ],
          ['شرایط لغو', revision.cancellationTerms || '—'],
          ['شرایط استرداد', revision.refundTerms || '—'],
          ['یادداشت', revision.notes || '—'],
          ['دلیل نسخه', revision.changeReason],
          [
            'سند قرارداد',
            revision.documentVersionId
              ? 'نسخه ثابت سند متصل است'
              : 'بدون پیوست',
          ],
          ['نتیجه بررسی', revision.reviewReason ?? '—'],
        ].map(([label, text]) => (
          <div className="summary-row" key={label}>
            <span>{label}</span>
            <b>{text}</b>
          </div>
        ))}
      </div>
      {revision.creditPolicies.length ? (
        <>
          <h4>سقف‌های ارزی این نسخه</h4>
          <div className="agreement-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ارز</th>
                  <th>سقف</th>
                  <th>کنترل</th>
                  <th>مهلت بدهی</th>
                  <th>سررسید گذشته</th>
                  <th>اعتبار</th>
                </tr>
              </thead>
              <tbody>
                {revision.creditPolicies.map((p) => (
                  <tr key={p.currencyCode}>
                    <td dir="ltr">{p.currencyCode}</td>
                    <td dir="ltr">{p.creditLimit}</td>
                    <td>{p.limitType === 'HARD' ? 'سخت' : 'نرم'}</td>
                    <td>{p.dueDays} روز</td>
                    <td>{p.overdueAction === 'BLOCK' ? 'توقف' : 'هشدار'}</td>
                    <td>
                      {p.effectiveFrom} — {p.expiresAt ?? 'بدون پایان'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      {revision.guarantees.length ? (
        <>
          <h4>تضمین‌های این نسخه</h4>
          {revision.guarantees.map((g, i) => (
            <div className="agreement-subcard" key={i}>
              <b>
                {
                  {
                    BANK_GUARANTEE: 'ضمانت‌نامه بانکی',
                    CHEQUE: 'چک تضمین',
                    DEPOSIT_REQUIREMENT: 'شرط سپرده',
                    OTHER: 'سایر تضمین',
                  }[g.kind]
                }{' '}
                — {g.reference}
              </b>
              <p>
                {g.amount} {g.currencyCode} · {g.issuer} ·{' '}
                {g.status === 'RECEIVED' ? 'دریافت‌شده' : 'موردنیاز'}
              </p>
              <p>
                تاریخ: {g.receivedAt} · انقضا: {g.expiresAt ?? 'بدون پایان'} ·{' '}
                {g.documentVersionId ? 'سند متصل' : 'بدون سند'}
              </p>
            </div>
          ))}
        </>
      ) : null}
      <p className="panel-note">
        ثبت نسخه: {new Date(revision.createdAt).toLocaleString('fa-IR')}
        {revision.submittedAt
          ? ` · ارسال: ${new Date(revision.submittedAt).toLocaleString('fa-IR')}`
          : ''}
        {revision.reviewedAt
          ? ` · بررسی: ${new Date(revision.reviewedAt).toLocaleString('fa-IR')}`
          : ''}
      </p>
    </div>
  );
}

export function AgreementWorkflowPanel({
  organizationId,
  role,
  view = 'agreements',
}: {
  organizationId: string;
  role: B2bCooperationRole;
  view?: 'agreements' | 'credit' | 'guarantees';
}) {
  const [branches, setBranches] = useState<readonly BranchReference[]>([]);
  const [permissions, setPermissions] = useState<readonly IamPermissionCode[]>(
    [],
  );
  const [userId, setUserId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [records, setRecords] = useState<B2bAgreementCaseV1[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [editor, setEditor] = useState<{
    record?: B2bAgreementCaseV1;
    terms: B2bAgreementTermsV1;
    requestId: string;
  } | null>(null);
  const [action, setAction] = useState<{
    record: B2bAgreementCaseV1;
    kind: 'submit' | 'APPROVE' | 'REJECT';
    reason: string;
    requestId: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const current = ++sequence.current;
    setLoading(true);
    setError('');
    setRecords([]);
    try {
      const user = await agencyClient.session();
      if (current !== sequence.current) return;
      setPermissions(user.permissions);
      setUserId(user.id);
      setBranches(user.branches);
      const branch =
        user.branches.find((b) => b.id === branchId)?.id ??
        user.branches[0]?.id;
      if (!branch) throw new Error('شعبه مجاز وجود ندارد.');
      if (branch !== branchId) {
        setBranchId(branch);
        return;
      }
      if (
        !user.permissions.includes('b2b.agreement.read') ||
        !user.permissions.includes('b2b.credit.read')
      )
        throw new Error(
          'برای مشاهده قرارداد و سیاست‌های ارزی، مجوز مشاهده قرارداد و اعتبار لازم است.',
        );
      const response = await agencyClient.agreements(
        organizationId,
        branch,
        role,
        page,
      );
      if (current !== sequence.current) return;
      setRecords(response.data);
      setPages(response.meta.totalPages);
    } catch (caught) {
      if (current === sequence.current)
        setError(
          caught instanceof Error
            ? caught.message
            : 'دریافت قراردادها ناموفق بود.',
        );
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, [organizationId, role, branchId, page]);
  const invalidate = useCallback(() => {
    ++sequence.current;
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(timer);
      invalidate();
    };
  }, [load, refresh, invalidate]);
  const canManage =
    permissions.includes('b2b.agreement.manage') &&
    permissions.includes('b2b.agreement.read') &&
    permissions.includes('b2b.credit.read');
  function edit(record?: B2bAgreementCaseV1) {
    setDialogError('');
    setUncertain(false);
    const latest = record?.revisions[0];
    setEditor({
      ...(record ? { record } : {}),
      terms: latest
        ? {
            ...editableAgreementTerms(latest),
            creditPolicies: latest.creditPolicies.map((p) => ({ ...p })),
            guarantees: latest.guarantees.map((g) => ({ ...g })),
            changeReason: latest.status === 'DRAFT' ? latest.changeReason : '',
          }
        : {
            ...blankAgreementTerms(),
            ...(record
              ? {
                  title: record.title,
                  startsAt: record.startsAt,
                  endsAt: record.endsAt,
                }
              : {}),
          },
      requestId: crypto.randomUUID(),
    });
  }
  function begin(
    record: B2bAgreementCaseV1,
    kind: 'submit' | 'APPROVE' | 'REJECT',
  ) {
    setDialogError('');
    setUncertain(false);
    setAction({
      record,
      kind,
      reason: kind === 'submit' ? 'ارسال برای بررسی قرارداد و اعتبار' : '',
      requestId: crypto.randomUUID(),
    });
  }
  async function save() {
    if (!editor || busy) return;
    const issue = b2bAgreementTermsIssue(editor.terms);
    if (issue) {
      setDialogError(issue);
      return;
    }
    setBusy(true);
    setDialogError('');
    try {
      await agencyClient.saveAgreementTerms(
        organizationId,
        {
          branchId,
          role,
          requestId: editor.requestId,
          ...(editor.record ? { version: editor.record.version } : {}),
          terms: editor.terms,
        },
        editor.record?.id,
      );
      setEditor(null);
      setUncertain(false);
      setNotice('پیش‌نویس قرارداد، سقف‌ها و تضمین‌ها ذخیره شد.');
      setRefresh((n) => n + 1);
    } catch (caught) {
      setDialogError(
        caught instanceof Error ? caught.message : 'ذخیره ناموفق بود.',
      );
      setUncertain(
        !(
          caught instanceof B2bApiError &&
          caught.status > 0 &&
          caught.status < 500
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  async function perform() {
    if (!action || busy) return;
    if (action.reason.trim().length < 3) {
      setDialogError('توضیح ارسال یا نتیجه بررسی را وارد کنید.');
      return;
    }
    setBusy(true);
    setDialogError('');
    try {
      await agencyClient.agreementAction(
        organizationId,
        action.record.id,
        action.kind === 'submit' ? 'submit' : 'review',
        {
          branchId,
          role,
          requestId: action.requestId,
          version: action.record.version,
          reason: action.reason,
          ...(action.kind !== 'submit' ? { decision: action.kind } : {}),
        },
      );
      setAction(null);
      setUncertain(false);
      setNotice(
        action.kind === 'submit'
          ? 'نسخه برای تأیید مستقل ارسال شد.'
          : action.kind === 'APPROVE'
            ? 'قرارداد و شرایط این نسخه تأیید شد.'
            : 'نسخه رد شد؛ علت در تاریخچه ثبت شده است.',
      );
      setRefresh((n) => n + 1);
    } catch (caught) {
      setDialogError(
        caught instanceof Error ? caught.message : 'ثبت نتیجه ناموفق بود.',
      );
      setUncertain(
        !(
          caught instanceof B2bApiError &&
          caught.status > 0 &&
          caught.status < 500
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="agreement-workflow">
      <div className="agreement-row-title">
        <div>
          <h3>
            {view === 'credit'
              ? 'سیاست‌های اعتبار'
              : view === 'guarantees'
                ? 'تضمین‌های قرارداد'
                : 'قراردادهای همکاری'}
          </h3>
          <p className="panel-note">
            نسخه‌بندی، ویرایش پیش‌نویس و تأیید مستقل قرارداد و شرایط ارزی
          </p>
        </div>
        <label className="field">
          <span>شعبه قرارداد</span>
          <select
            className="input"
            value={branchId}
            disabled={loading}
            onChange={(e) => {
              setBranchId(e.target.value);
              setPage(1);
              setNotice('');
            }}
          >
            {branches.map((b) => (
              <option value={b.id} key={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn"
          disabled={loading}
          onClick={() => setRefresh((n) => n + 1)}
        >
          <RefreshCw size={16} />
          تازه‌سازی
        </button>
        {canManage ? (
          <button
            className="btn primary"
            disabled={loading || !branchId}
            onClick={() => edit()}
          >
            <Plus size={16} />
            قرارداد جدید
          </button>
        ) : null}
      </div>
      {error ? (
        <div role="alert" className="form-error">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div role="status" className="boundary-note">
          {notice}
        </div>
      ) : null}
      {view === 'credit' ? (
        <div className="boundary-note">
          سقف‌ها پس از تأیید و در بازه اعتبارشان معتبرند. مانده قابل‌استفاده
          تنها با دریافت مانده مالی محاسبه می‌شود؛ اتصال مانده مالی این بخش هنوز
          آماده نیست.
        </div>
      ) : null}
      {loading ? (
        <p role="status">در حال دریافت قراردادها…</p>
      ) : !error && !records.length ? (
        <div className="agreement-empty">
          <FileText size={32} />
          <h4>قراردادی در این شعبه ثبت نشده است</h4>
          <p>قرارداد و شرایط همکاری را به صورت پیش‌نویس ثبت کنید.</p>
        </div>
      ) : null}
      {records.map((record) => {
        const latest = record.revisions[0];
        const active = record.revisions.find(
          (r) => r.id === record.activeRevisionId,
        );
        const withCredit = Boolean(
          latest && (latest.creditPolicies.length || latest.guarantees.length),
        );
        const manage =
          canManage &&
          (!withCredit || permissions.includes('b2b.credit.manage'));
        const independent =
          latest &&
          latest.createdByUserId !== userId &&
          latest.submittedByUserId !== userId;
        const review =
          permissions.includes('b2b.agreement.approve') &&
          (!withCredit || permissions.includes('b2b.credit.approve')) &&
          independent;
        return (
          <article className="agreement-section" key={record.id}>
            <div className="agreement-row-title">
              <div>
                <h4>{record.title}</h4>
                <p className="panel-note">
                  <bdi>{record.code}</bdi> ·{' '}
                  {active
                    ? `نسخه تأییدشده ${active.number}`
                    : 'بدون نسخه تأییدشده'}
                </p>
              </div>
              <span
                className={`badge ${latest?.status === 'APPROVED' ? 'green' : latest?.status === 'REJECTED' ? 'red' : ''}`}
              >
                {latest
                  ? reviewLabels[latest.status]
                  : 'قرارداد قدیمی — نیازمند تکمیل شرایط'}
              </span>
            </div>
            {latest ? (
              <>
                <details open={view !== 'agreements'}>
                  <summary>
                    <FileText size={16} />
                    جزئیات نسخه {latest.number}
                  </summary>
                  <RevisionSummary revision={latest} />
                </details>
                {active && active.id !== latest.id ? (
                  <p className="boundary-note">
                    نسخه تأییدشده {active.number} تا تأیید اصلاحیه معتبر باقی
                    می‌ماند.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="panel-note">
                {record.startsAt} تا {record.endsAt ?? 'بدون پایان'}؛ برای تکمیل
                شرایط، نسخه جدید ثبت کنید.
              </p>
            )}
            <div className="agreement-actions">
              {manage && latest?.status !== 'PENDING' ? (
                <button className="btn" onClick={() => edit(record)}>
                  <Pencil size={16} />
                  {latest && latest.status !== 'DRAFT'
                    ? 'ثبت اصلاحیه / نسخه جدید'
                    : 'ویرایش پیش‌نویس'}
                </button>
              ) : null}
              {manage && latest?.status === 'DRAFT' ? (
                <button
                  className="btn primary"
                  onClick={() => begin(record, 'submit')}
                >
                  <Send size={16} />
                  ارسال برای تأیید
                </button>
              ) : null}
              {review && latest?.status === 'PENDING' ? (
                <>
                  <button
                    className="btn primary"
                    onClick={() => begin(record, 'APPROVE')}
                  >
                    <ShieldCheck size={16} />
                    تأیید نسخه
                  </button>
                  <button
                    className="btn danger"
                    onClick={() => begin(record, 'REJECT')}
                  >
                    رد با ذکر دلیل
                  </button>
                </>
              ) : null}
              {latest?.status === 'PENDING' && !independent ? (
                <span className="panel-note">
                  بررسی این نسخه باید توسط کاربر مستقل انجام شود.
                </span>
              ) : null}
            </div>
            {record.revisions.length > 1 ? (
              <details>
                <summary>
                  <History size={16} />
                  تاریخچه نسخه‌ها ({record.revisions.length - 1})
                </summary>
                {record.revisions.slice(1).map((revision) => (
                  <details key={revision.id}>
                    <summary>
                      نسخه {revision.number} · {reviewLabels[revision.status]}{' '}
                      {revision.id === record.activeRevisionId
                        ? '· نسخه تأییدشده'
                        : ''}
                    </summary>
                    <RevisionSummary revision={revision} />
                  </details>
                ))}
              </details>
            ) : null}
          </article>
        );
      })}
      {pages > 1 ? (
        <div className="agreement-actions">
          <button
            className="btn"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            صفحه قبل
          </button>
          <span>
            {page} / {pages}
          </span>
          <button
            className="btn"
            disabled={page >= pages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            صفحه بعد
          </button>
        </div>
      ) : null}
      {editor ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !busy) {
              setEditor(null);
              if (uncertain) setRefresh((n) => n + 1);
            }
          }}
        >
          <DialogContent
            className="b2b-design b2b-modal agreement-modal"
            dir="rtl"
            onInteractOutside={(e) => e.preventDefault()}
          >
            <DialogTitle>
              {editor.record ? 'ویرایش و نسخه‌بندی قرارداد' : 'قرارداد جدید'}
            </DialogTitle>
            <DialogDescription>
              قرارداد و سقف‌های ارزی پس از تأیید مستقل فعال می‌شوند.
            </DialogDescription>
            <AgreementTermsEditor
              value={editor.terms}
              role={role}
              branchId={branchId}
              organizationId={organizationId}
              permissions={permissions}
              disabled={busy || uncertain}
              onChange={(terms) =>
                setEditor({ ...editor, terms, requestId: crypto.randomUUID() })
              }
            />
            {dialogError ? (
              <div role="alert" className="form-error">
                {dialogError}
              </div>
            ) : null}
            {uncertain ? (
              <p className="boundary-note">
                نتیجه درخواست مشخص نیست؛ تلاش دوباره همان درخواست را پیگیری
                می‌کند و قرارداد تکراری نمی‌سازد.
              </p>
            ) : null}
            <div className="wizard-actions">
              <button
                className="btn"
                disabled={busy}
                onClick={() => {
                  setEditor(null);
                  if (uncertain) setRefresh((n) => n + 1);
                }}
              >
                بستن
              </button>
              <button
                className="btn primary"
                disabled={busy}
                onClick={() => void save()}
              >
                {busy
                  ? 'در حال ذخیره…'
                  : uncertain
                    ? 'پیگیری درخواست قبلی'
                    : 'ذخیره پیش‌نویس'}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
      {action ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !busy) setAction(null);
          }}
        >
          <DialogContent
            className="b2b-design b2b-modal agreement-review-modal"
            dir="rtl"
            onInteractOutside={(e) => e.preventDefault()}
          >
            <DialogTitle>
              {action.kind === 'submit'
                ? 'ارسال نسخه برای تأیید'
                : action.kind === 'APPROVE'
                  ? 'تأیید قرارداد و شرایط ارزی'
                  : 'رد نسخه قرارداد'}
            </DialogTitle>
            <DialogDescription>
              {action.record.title} · نسخه {action.record.revisions[0]?.number}
            </DialogDescription>
            {action.record.revisions[0] ? (
              <RevisionSummary revision={action.record.revisions[0]} />
            ) : null}
            <label className="field">
              <span>توضیح تصمیم *</span>
              <textarea
                className="textarea"
                maxLength={500}
                disabled={busy || uncertain}
                value={action.reason}
                onChange={(e) =>
                  setAction({
                    ...action,
                    reason: e.target.value,
                    requestId: crypto.randomUUID(),
                  })
                }
              />
            </label>
            {dialogError ? (
              <div role="alert" className="form-error">
                {dialogError}
              </div>
            ) : null}
            {uncertain ? (
              <p className="boundary-note">
                نتیجه نامشخص است؛ با همان شناسه درخواست دوباره پیگیری کنید.
              </p>
            ) : null}
            <div className="wizard-actions">
              <button
                className="btn"
                disabled={busy}
                onClick={() => setAction(null)}
              >
                انصراف
              </button>
              <button
                className="btn primary"
                disabled={busy}
                onClick={() => void perform()}
              >
                {busy
                  ? 'در حال ثبت…'
                  : uncertain
                    ? 'پیگیری درخواست'
                    : action.kind === 'submit'
                      ? 'ارسال برای تأیید'
                      : action.kind === 'APPROVE'
                        ? 'ثبت تأیید'
                        : 'ثبت رد'}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
