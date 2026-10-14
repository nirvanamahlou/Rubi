'use client';
import { ReservationPassengers } from '../passenger-files/passengers';
import { ReservationPartyEditor } from './reservation-party-editor';
import { TravelWorkflowForm } from './travel-workflow-form';

import { useEffect, useState } from 'react';
import type {
  ReservationIntakeV1,
  SalesContractDetail,
  TravelWorkflowCommandV1,
  TravelWorkflowStateV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form-controls';
import { salesApi } from '@/modules/sales/api/client';
import { ReservationSalesAmendment } from './reservation-sales-amendment';
import { travelRequest } from './travel-workflow-form';
import styles from './reservation-contract-editor.module.css';

type WorkflowIntake = ReservationIntakeV1 & {
  contractEditVersion: number;
  workflow: TravelWorkflowStateV1;
};
type HistoryItem = {
  version: number;
  createdAt: string;
  state: TravelWorkflowStateV1;
};

const sections = [
  'طرف قرارداد',
  'پرواز',
  'هتل',
  'مبالغ فروش',
  'ویرایش مسافران',
  'سوابق',
  'ابطال قرارداد',
] as const;
type Section = (typeof sections)[number];

const dateTime = (input: string | null | undefined) =>
  input ? new Date(input).toLocaleString('fa-IR') : 'ثبت نشده';

function WorkflowCommand({
  id,
  intake,
  action,
  onSaved,
}: {
  id: string;
  intake: WorkflowIntake;
  action: Extract<TravelWorkflowCommandV1['action'], 'CANCEL' | 'REOPEN'>;
  onSaved: (state: TravelWorkflowStateV1) => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const cancelled = intake.workflow.supplierStatus === 'CANCELLED';
  const available = action === 'CANCEL' ? !cancelled : cancelled;

  async function submit() {
    if (!reason.trim()) {
      setError('دلیل عملیات را وارد کنید.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await travelRequest<{ data: TravelWorkflowStateV1 }>(
        `reservations/requests/${id}/workflow`,
        {
          action,
          expectedVersion: intake.workflow.version,
          note: reason.trim(),
        },
      );
      onSaved(response.data);
      setReason('');
      setMessage(
        action === 'CANCEL'
          ? 'ابطال در گردش‌کار رزواسیون ثبت شد.'
          : 'ابطال لغو شد و قرارداد به صف درخواست‌های جدید برگشت.',
      );
      window.dispatchEvent(new Event('reservation-workflow-changed'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ثبت انجام نشد.');
    } finally {
      setBusy(false);
    }
  }

  if (!available)
    return (
      <p className={styles.notice}>
        {action === 'CANCEL'
          ? 'این قرارداد در گردش‌کار رزواسیون ابطال شده است.'
          : 'قرارداد فعال است و ابطالی برای لغو وجود ندارد.'}
      </p>
    );
  return (
    <div className={styles.command}>
      <p>
        {action === 'CANCEL'
          ? 'با تأیید این بخش، عملیات این قرارداد در رزواسیون متوقف و در سابقه ثبت می‌شود.'
          : 'لغو ابطال، قرارداد را با یک نسخه جدید به وضعیت «درخواست جدید» برمی‌گرداند.'}
      </p>
      <label>
        دلیل {action === 'CANCEL' ? 'ابطال' : 'لغو ابطال'}
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <Button
        variant={action === 'CANCEL' ? 'destructive' : 'primary'}
        disabled={busy}
        onClick={() => void submit()}
      >
        {busy
          ? 'در حال ثبت…'
          : action === 'CANCEL'
            ? 'تأیید و ثبت ابطال'
            : 'لغو ابطال و بازگردانی'}
      </Button>
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function ReservationContractEditor({
  requestId,
  contractId,
  contractNumber,
}: {
  requestId: string;
  contractId?: string;
  contractNumber: string;
}) {
  const [active, setActive] = useState<Section>('طرف قرارداد');
  const [revision, setRevision] = useState(0);
  const [contract, setContract] = useState<SalesContractDetail>();
  const [intake, setIntake] = useState<WorkflowIntake>();
  const [versions, setVersions] = useState<
    { id: string; contractVersion: number; receivedAt: string }[]
  >([]);
  const [viewVersion, setViewVersion] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    void travelRequest<{
      data: { id: string; contractVersion: number; receivedAt: string }[];
    }>(`reservations/requests/${requestId}/contract-versions`)
      .then((r) => {
        if (mounted) setVersions(r.data);
      })
      .catch(() => undefined);
    const loadContract = contractId
      ? salesApi.detail(contractId).then((result) => result.data)
      : Promise.resolve(undefined);
    void Promise.allSettled([
      loadContract,
      travelRequest<{ data: WorkflowIntake }>(
        `reservations/requests/${requestId}/workflow`,
      ).then((result) => result.data),
      travelRequest<{ data: HistoryItem[] }>(
        `reservations/requests/${requestId}/workflow/history`,
      ).then((result) => result.data),
    ]).then(([contractResult, intakeResult, historyResult]) => {
      if (!mounted) return;
      if (contractResult.status === 'fulfilled')
        setContract(contractResult.value);
      if (intakeResult.status === 'fulfilled') setIntake(intakeResult.value);
      if (historyResult.status === 'fulfilled') setHistory(historyResult.value);
      if (contractResult.status === 'rejected')
        setError(
          contractResult.reason instanceof Error
            ? contractResult.reason.message
            : 'اطلاعات قرارداد دریافت نشد.',
        );
      if (intakeResult.status === 'rejected')
        setError(
          intakeResult.reason instanceof Error
            ? intakeResult.reason.message
            : 'اطلاعات اصلاح قرارداد دریافت نشد.',
        );
    });
    return () => {
      mounted = false;
    };
  }, [contractId, requestId, revision]);

  const editSection =
    active === 'پرواز' ? 'FLIGHT' : active === 'هتل' ? 'HOTEL' : undefined;
  const updateWorkflow = (workflow: TravelWorkflowStateV1) =>
    setIntake((current) =>
      current
        ? {
            ...current,
            contractEditVersion:
              workflow.appliedContractVersion ?? current.contractEditVersion,
            workflow,
          }
        : current,
    );

  return (
    <div className={styles.editor} dir="rtl">
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <span className={styles.eyebrow}>ویرایش قرارداد</span>
          <div className={styles.titleLine}>
            <h2>اصلاح قرارداد</h2>
            <strong>{contractNumber}</strong>
          </div>
        </div>
        <span className={styles.versionBadge}>
          نسخهٔ عملیاتی {intake?.workflow.version ?? '—'}
        </span>
      </header>
      <nav
        className={styles.tabs}
        aria-label="بخش‌های اصلاح قرارداد"
        role="tablist"
      >
        {sections.map((section, index) => (
          <button
            key={section}
            type="button"
            role="tab"
            aria-selected={active === section}
            className={`${styles.tab} ${
              active === section ? styles.activeTab : ''
            }`}
            onClick={() => setActive(section)}
          >
            <span className={styles.tabNumber}>
              {String(index + 1).padStart(2, '0')}
            </span>
            <span>{section}</span>
          </button>
        ))}
      </nav>
      <section className={styles.content} role="tabpanel" aria-label={active}>
        <div className={styles.contentHeading}>
          <span>بخش فعال</span>
          <strong>{active}</strong>
        </div>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {active === 'طرف قرارداد' &&
          (contract ? (
            <ReservationPartyEditor
              key={contract.version}
              contract={contract}
              onSaved={() => setRevision((v) => v + 1)}
            />
          ) : (
            <p role="status">در حال دریافت اطلاعات طرف قرارداد…</p>
          ))}
        {(editSection ||
          active === 'ویرایش مسافران' ||
          active === 'مبالغ فروش') &&
          contract && (
            <ReservationSalesAmendment
              key={active + contract.version}
              contract={contract}
              section={
                active === 'ویرایش مسافران'
                  ? 'CORRECTION'
                  : active === 'مبالغ فروش'
                    ? 'PRICES'
                    : editSection!
              }
              onSaved={() => setRevision((v) => v + 1)}
            />
          )}
        {active === 'ویرایش مسافران' && (
          <ReservationPassengers key={requestId} id={requestId} />
        )}
        {active === 'سوابق' && (
          <div className={styles.history}>
            <div className="flex flex-wrap gap-2">
              {versions.map((v) => (
                <Button
                  key={v.id}
                  variant="outline"
                  onClick={() => setViewVersion(v.id)}
                >
                  مشاهده فرم نسخه {v.contractVersion}
                </Button>
              ))}
            </div>
            {viewVersion && (
              <TravelWorkflowForm
                key={viewVersion}
                id={viewVersion}
                action="رزرواسیون"
                readOnly
              />
            )}
            {history.map((item) => (
              <article key={item.version}>
                <strong>نسخه {item.version}</strong>
                <span>{item.state.note || 'بدون توضیح'}</span>
                <small>
                  {dateTime(item.createdAt)} · {item.state.supplierStatus}
                </small>
              </article>
            ))}
            {!history.length && (
              <p className={styles.notice}>هنوز سابقه‌ای دریافت نشده است.</p>
            )}
          </div>
        )}
        {active === 'ابطال قرارداد' &&
          (intake ? (
            <WorkflowCommand
              id={requestId}
              intake={intake}
              action={
                intake.workflow.supplierStatus === 'CANCELLED'
                  ? 'REOPEN'
                  : 'CANCEL'
              }
              onSaved={updateWorkflow}
            />
          ) : (
            <p role="status">در حال دریافت وضعیت…</p>
          ))}
      </section>
    </div>
  );
}
