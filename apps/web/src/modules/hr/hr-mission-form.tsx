'use client';
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useHrReferenceData } from './hr-reference-data';
import { procurementRequest } from '@/modules/procurement/api';
import type {
  HrRecordDto,
  HrWorkflowData,
  ProcurementDocumentReferenceV1,
} from '@nora/contracts';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';
import { MoneyInput } from '@/components/ui/money-input';
import { documentsApi } from '@/modules/documents/api/client';
import { HrButton } from './hr-controls';
import type { HrFormTarget } from './hr-record-form';
import type { HrStore } from './hr-store';
import ui from './hr-unified.module.css';
export function HrMissionForm({
  target,
  store,
  onClose,
  onSaved,
}: {
  target: HrFormTarget;
  store: HrStore;
  onClose: () => void;
  onSaved: (r: HrRecordDto) => void;
}) {
  const references = useHrReferenceData(store);
  const claim = target.source.tab === 'claims';
  const [parentId, setParentId] = useState(
    target.record?.parentId ?? target.parent?.id ?? '',
  );
  const queryClient = useQueryClient();
  const record = target.record,
    old = record?.values ?? [],
    expense = record?.data.missionExpense;
  const [employeeId, setEmployeeId] = useState(
    target.employeeId ?? record?.employeeId ?? '',
  );
  const employee = store.data!.employees.find((e) => e.id === employeeId);
  const [destination, setDestination] = useState(old[1] ?? ''),
    [from, setFrom] = useState(old[2] ?? ''),
    [to, setTo] = useState(claim ? (old[2] ?? '') : (old[3] ?? '')),
    [purpose, setPurpose] = useState(old[4] ?? '');
  const clock = (v?: string) =>
    v
      ? new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Tehran',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        }).format(new Date(v))
      : '';
  const [start, setStart] = useState(clock(record?.data.startsAt)),
    [end, setEnd] = useState(clock(record?.data.endsAt));
  const [amount, setAmount] = useState(
      expense?.amount ?? (claim ? old[4] : undefined) ?? '0',
    ),
    [refer, setRefer] = useState(expense?.referToPetty ?? false),
    [title, setTitle] = useState(expense?.title ?? ''),
    [center, setCenter] = useState(expense?.costCenter ?? ''),
    [fee, setFee] = useState(expense?.fee ?? '0'),
    [description, setDescription] = useState(expense?.description ?? '');
  const [file, setFile] = useState<File | null>(null),
    [receipt, setReceipt] = useState<
      ProcurementDocumentReferenceV1 | undefined
    >(expense?.receipt);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const attempt = useRef({ body: '', key: crypto.randomUUID() }),
    uploadId = useRef(crypto.randomUUID());
  const locked = false;
  const fund = useQuery({
    queryKey: ['procurement', 'petty-fund', employee?.branchId],
    queryFn: () =>
      procurementRequest<{ balance: string; currencyCode: string } | null>(
        `/petty-fund?branchId=${encodeURIComponent(employee!.branchId)}`,
      ),
    enabled: refer && Boolean(employee),
  });
  const [currencyOverride, setCurrencyOverride] = useState(
    record?.data.currency ?? (claim ? old[3] : undefined) ?? 'IRR',
  );
  const currency = refer ? fund.data?.currencyCode : currencyOverride;
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <DialogContent
        dir="rtl"
        aria-describedby={undefined}
        className="max-h-[90dvh] max-w-3xl overflow-y-auto"
      >
        <DialogTitle>{claim ? 'ثبت هزینه مستقل' : 'ماموریت'}</DialogTitle>
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!employee || busy || locked) return;
            setBusy(true);
            setError('');
            try {
              let proof = receipt;
              if (file && !proof) {
                const { data: options } = await documentsApi.options();
                const type = options.documentTypes.find(
                    (t) => t.domain === 'PROCUREMENT',
                  ),
                  category = options.categories[0];
                if (!type || !category)
                  throw new Error('نوع سند خرید تعریف نشده است.');
                const form = new FormData();
                form.set('file', file);
                form.set('title', title || purpose);
                form.set('documentTypeId', type.id);
                form.set('categoryId', category.id);
                form.set('branchId', employee.branchId);
                form.set('ownerUserId', options.currentUserId);
                form.set('confidentiality', 'INTERNAL');
                form.set('sourceModule', 'PROCUREMENT');
                form.set('sourceEntityType', 'ProcurementPettyRegistration');
                form.set('sourceEntityId', uploadId.current);
                const { data: d } = await documentsApi.upload(form);
                proof = { id: d.id, versionId: d.currentVersion.id };
                setReceipt(proof);
              }
              const data: HrWorkflowData = {
                currency: currency ?? 'IRR',
                startsAt: new Date(
                  `${from}T${claim ? '12:00' : start}:00+03:30`,
                ).toISOString(),
                ...(claim
                  ? {}
                  : {
                      endsAt: new Date(`${to}T${end}:00+03:30`).toISOString(),
                    }),
                missionExpense: {
                  amount,
                  title: title || purpose,
                  costCenter: center,
                  fee: fee || '0',
                  description,
                  referToPetty: refer,
                  ...(proof ? { receipt: proof } : {}),
                },
              };
              const input = {
                section: 'expenses',
                tab: claim ? 'claims' : 'mission',
                ...(claim && parentId ? { parentId } : {}),
                branchId: employee.branchId,
                employeeId,
                values: claim
                  ? [
                      employee.name,
                      destination || 'عادی',
                      from,
                      currency ?? 'IRR',
                      amount,
                      proof ? `document://${proof.id}` : '',
                      'ثبت اولیه',
                    ]
                  : [employee.name, destination, from, to, purpose, '—'],
                status: 'تأییدشده',
                data,
              };
              const body = JSON.stringify(input);
              if (body !== attempt.current.body)
                attempt.current = { body, key: crypto.randomUUID() };
              const saved = record
                ? await store.update(record, {
                    values: input.values,
                    ...(claim ? { parentId: parentId || null } : {}),
                    data,
                  })
                : await store.create(input, attempt.current.key);
              onSaved(saved);
              onClose();
              void queryClient.invalidateQueries({
                queryKey: ['procurement', 'petty-fund'],
              });
              void queryClient.invalidateQueries({
                queryKey: ['procurement', 'registrations'],
              });
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : 'ثبت مأموریت انجام نشد.',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset
            disabled={busy || locked}
            className="grid gap-4 sm:grid-cols-2"
          >
            <label className={ui.field}>
              کارمند
              <NativeSearchSelect
                required
                value={employeeId}
                disabled={Boolean(target.employeeId || record)}
                onChange={(e) => {
                  setEmployeeId(e.target.value);
                  setFile(null);
                  setReceipt(undefined);
                }}
              >
                <option value="">انتخاب کارمند</option>
                {store.data!.employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} · {e.personnelCode}
                  </option>
                ))}
              </NativeSearchSelect>
            </label>
            <label className={ui.field}>
              شعبه
              <input
                readOnly
                value={
                  employee?.companyName ||
                  store.data!.branches.find((b) => b.id === employee?.branchId)
                    ?.name ||
                  ''
                }
              />
            </label>
            {claim ? (
              <>
                <label className={ui.field}>
                  مأموریت مرجع
                  <NativeSearchSelect
                    value={parentId}
                    disabled={
                      record?.status === 'تأییدشده' ||
                      record?.status === 'تاییدشده'
                    }
                    onChange={(e) => setParentId(e.target.value)}
                  >
                    <option value="">بدون مأموریت (هزینه مستقل)</option>
                    {references.data.records
                      .filter(
                        (r) =>
                          r.section === 'expenses' &&
                          r.tab === 'mission' &&
                          r.employeeId === employeeId &&
                          !r.deletedAt,
                      )
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.code} · {r.values[1]}
                        </option>
                      ))}
                  </NativeSearchSelect>
                </label>
                <label className={ui.field}>
                  نوع هزینه
                  <input
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                  />
                </label>
                <label className={ui.field}>
                  تاریخ هزینه
                  <DatePicker value={from} onChange={setFrom} />
                </label>
              </>
            ) : (
              <>
                {' '}
                <label className={ui.field}>
                  مقصد
                  <input
                    required
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                  />
                </label>
                <label className={ui.field}>
                  هدف مأموریت
                  <input
                    required
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                  />
                </label>
                <label className={ui.field}>
                  تاریخ رفت
                  <DatePicker value={from} onChange={setFrom} />
                </label>
                <label className={ui.field}>
                  تاریخ برگشت
                  <DatePicker value={to} onChange={setTo} />
                </label>
                <label className={ui.field}>
                  ساعت رفت
                  <TimePicker
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </label>
                <label className={ui.field}>
                  ساعت برگشت
                  <TimePicker
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </label>
              </>
            )}
            {claim && (
              <label className={ui.field}>
                ارز
                <input
                  required
                  maxLength={3}
                  pattern="[A-Z]{3}"
                  value={currency ?? ''}
                  disabled={refer}
                  onChange={(e) =>
                    setCurrencyOverride(e.target.value.toUpperCase())
                  }
                />
              </label>
            )}
            <label className={ui.field}>
              هزینه {currency ? `(${currency})` : ''}
              <MoneyInput value={amount} onValueChange={setAmount} />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={refer}
                disabled={busy}
                onChange={(e) => setRefer(e.target.checked)}
              />
              ارجاع به تنخواه
            </label>
            <label className={ui.field}>
              عنوان هزینه
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className={ui.field}>
              مرکز هزینه
              <input
                value={center}
                onChange={(e) => setCenter(e.target.value)}
              />
            </label>
            <label className={ui.field}>
              کارمزد
              <MoneyInput value={fee} onValueChange={setFee} />
            </label>
            <label className={ui.field}>
              شرح
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label className={ui.field}>
              مدرک
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setReceipt(undefined);
                }}
              />
            </label>
          </fieldset>
          {refer && fund.error ? (
            <p role="alert">{fund.error.message}</p>
          ) : null}
          {error ? (
            <p role="alert" className={ui.error}>
              {error}
            </p>
          ) : null}
          <div className={ui.actions}>
            <HrButton
              type="submit"
              primary
              disabled={
                busy ||
                locked ||
                !employee ||
                !from ||
                (!claim && (!to || !start || !end)) ||
                (refer && !fund.data)
              }
            >
              {claim ? 'ثبت هزینه مستقل' : 'ثبت مأموریت'}
            </HrButton>
            <HrButton onClick={onClose} disabled={busy}>
              انصراف
            </HrButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
