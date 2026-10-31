'use client';
import { canSelfServeSalesContract } from '@nora/contracts';
import { ContractPriceCorrection } from './contract-price-correction';
import { PassengerCompletion } from './passenger-completion';
import { useEffect, useRef, useState } from 'react';
import type {
  SalesPassengerCorrectionCommandV1,
  SalesPassengerIdentityV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/form-controls';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/overlays';
import {
  useAccessActor,
  useAccessPermissions,
} from '@/modules/iam/access-context';
import { SalesApiError, salesApi } from '../api/client';
import { PassengerCorrectionHistory } from './passenger-correction-history';

function CorrectionForm({
  contractId,
  onSaved,
  onPending,
}: {
  contractId: string;
  onSaved: () => void;
  onPending: (pending: boolean) => void;
}) {
  const [rows, setRows] = useState<SalesPassengerIdentityV1[]>([]);
  const [version, setVersion] = useState(0);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [completionPending, setCompletionPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  const attempt = useRef<SalesPassengerCorrectionCommandV1 | null>(null);
  const lock = useRef(false);
  const original = useRef<SalesPassengerIdentityV1[]>([]);
  useEffect(() => {
    let active = true;
    void salesApi
      .passengerCorrectionForm(contractId)
      .then((result) => {
        if (active) {
          setRows(result.passengers);
          original.current = result.passengers;
          setVersion(result.version);
          setError('');
        }
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : 'دریافت مشخصات قرارداد ناموفق بود.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [contractId, revision]);
  function change(
    index: number,
    field: 'birthDate' | 'passportNumber' | 'passportExpiryDate',
    value: string,
  ) {
    setRows((old) =>
      old.map((row, i) =>
        i === index
          ? { ...row, [field]: value || (field === 'birthDate' ? '' : null) }
          : row,
      ),
    );
  }
  async function save() {
    if (lock.current || loading || completionPending || !version) return;
    lock.current = true;
    setBusy(true);
    onPending(true);
    setError('');
    setMessage('');
    attempt.current ??= {
      operationId: crypto.randomUUID(),
      expectedVersion: version,
      passengers: rows
        .filter((row) => {
          const before = original.current.find(
            (p) => p.customerId === row.customerId,
          );
          return (
            !before ||
            ['birthDate', 'passportNumber', 'passportExpiryDate'].some(
              (field) =>
                row[field as keyof SalesPassengerIdentityV1] !==
                before[field as keyof SalesPassengerIdentityV1],
            )
          );
        })
        .map(
          ({ customerId, birthDate, passportNumber, passportExpiryDate }) => ({
            customerId,
            birthDate,
            passportNumber,
            passportExpiryDate,
          }),
        ),
      note,
    };
    setUncertain(true);
    try {
      const result = await salesApi.correctPassengers(
        contractId,
        attempt.current,
      );
      attempt.current = null;
      setUncertain(false);
      onPending(false);
      setVersion(result.version);
      setNote('');
      setRevision((value) => value + 1);
      setMessage('اصلاح ثبت شد و به رزرواسیون اطلاع داده شد.');
      onSaved();
    } catch (cause) {
      if (
        cause instanceof SalesApiError &&
        [400, 403, 404, 409].includes(cause.status)
      ) {
        attempt.current = null;
        setUncertain(false);
        onPending(false);
      }
      setError(
        cause instanceof Error ? cause.message : 'ثبت اصلاح ناموفق بود.',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        اصلاحات فقط برای همین قرارداد ثبت می‌شوند؛ قیمت و تخصیص خدمات تغییر
        نمی‌کند.
      </p>
      {loading ? <p role="status">در حال دریافت مشخصات…</p> : null}
      {!loading && rows.length === 0 && (
        <PassengerCompletion
          contractId={contractId}
          onPending={(pending) => {
            setCompletionPending(pending);
            onPending(pending);
          }}
          onSaved={() => {
            setLoading(true);
            setMessage('اصلاح ثبت شد و به رزرواسیون اطلاع داده شد.');
            setRevision((value) => value + 1);
            onSaved();
          }}
        />
      )}
      <fieldset
        disabled={loading || busy || uncertain || completionPending}
        className="grid gap-3"
      >
        {rows.map((row, index) => (
          <div
            key={row.customerId}
            className="grid gap-3 rounded-xl border p-3 md:grid-cols-3"
          >
            <b className="md:col-span-3">{row.name}</b>
            <label className="grid gap-2">
              تاریخ تولد
              <DatePicker
                value={row.birthDate}
                onChange={(value) =>
                  change(index, 'birthDate', value.slice(0, 10))
                }
              />
            </label>
            <label className="grid gap-2">
              شماره پاسپورت
              <Input
                dir="ltr"
                maxLength={24}
                value={row.passportNumber || ''}
                onChange={(e) =>
                  change(index, 'passportNumber', e.target.value)
                }
              />
            </label>
            <label className="grid gap-2">
              انقضای پاسپورت
              <DatePicker
                value={row.passportExpiryDate || ''}
                onChange={(value) =>
                  change(index, 'passportExpiryDate', value.slice(0, 10))
                }
              />
            </label>
          </div>
        ))}
        <label className="grid gap-2">
          توضیحات برای رزرواسیون
          <Textarea
            value={note}
            maxLength={2000}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </fieldset>
      {uncertain && !busy ? (
        <p role="status">
          نتیجه هنوز قطعی نیست؛ همان اصلاح را دوباره ارسال کنید.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
      <div className="flex gap-2">
        <Button
          disabled={loading || busy || completionPending || !version}
          onClick={() => void save()}
        >
          {busy
            ? 'در حال ثبت…'
            : uncertain
              ? 'ارسال دوباره همان اصلاح'
              : 'ثبت اصلاح و اطلاع به رزرواسیون'}
        </Button>
        <Button
          variant="outline"
          disabled={busy || uncertain || completionPending}
          onClick={() => {
            setLoading(true);
            setRevision((value) => value + 1);
          }}
        >
          دریافت آخرین نسخه
        </Button>
      </div>
      <ContractPriceCorrection
        refreshVersion={revision}
        contractId={contractId}
        onSaved={() => {
          setRevision((value) => value + 1);
          onSaved();
        }}
      />
      <h3 className="font-bold">سوابق اصلاح قرارداد</h3>
      <PassengerCorrectionHistory key={revision} contractId={contractId} />
    </div>
  );
}

export function PassengerCorrectionButton({
  contractId,
  ownerUserId,
  branchId,
  status,
  onSaved,
}: {
  contractId: string;
  ownerUserId: string;
  branchId: string;
  status: string;
  onSaved: () => void;
}) {
  const permissions = useAccessPermissions();
  const actor = useAccessActor();
  const selfService = Boolean(
    actor && canSelfServeSalesContract(actor, { ownerUserId, branchId }),
  );
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  if (
    !['CONFIRMED', 'SENT_TO_RESERVATIONS', 'IN_PROGRESS', 'COMPLETED'].includes(
      status,
    ) ||
    (!selfService &&
      !permissions?.some(
        (p) =>
          p === 'sales.contracts.update.branch' ||
          p === 'sales.contracts.update.own' ||
          p === 'finance.read' ||
          p === 'sales.contracts.read.all',
      ))
  )
    return null;
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-8 px-2 text-xs"
        onClick={() => setOpen(true)}
      >
        اصلاح
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
      >
        <DialogContent
          dir="rtl"
          className="max-h-[90vh] max-w-4xl overflow-y-auto"
        >
          <DialogTitle>اصلاح مشخصات مسافران قرارداد</DialogTitle>
          <DialogDescription>
            تاریخ تولد، مشخصات پاسپورت و توضیحات رزرواسیون
          </DialogDescription>
          {open &&
          !selfService &&
          !permissions?.some(
            (p) =>
              p === 'sales.contracts.update.branch' ||
              p === 'sales.contracts.update.own',
          ) ? (
            <ContractPriceCorrection
              contractId={contractId}
              onSaved={onSaved}
            />
          ) : open ? (
            <CorrectionForm
              contractId={contractId}
              onSaved={onSaved}
              onPending={setPending}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
