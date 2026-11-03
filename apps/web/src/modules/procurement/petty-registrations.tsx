'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ProcurementDocumentReferenceV1,
  ProcurementListV1,
  ProcurementPettyRegistrationInputV1,
  ProcurementPettyRegistrationV1,
} from '@nora/contracts';
import {
  Button,
  DatePicker,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  FormField,
  Input,
  Alert,
  Card,
} from '@/components/ui';
import { Textarea } from '@/components/ui/form-controls';
import { MoneyInput } from '@/components/ui/money-input';
import { documentsApi } from '@/modules/documents/api/client';
import { MasterDataDateRangeFilter } from '@/modules/master-data/components/master-data-date-range-filter';
import { procurementRequest, type Bootstrap } from './api';
import { ProcurementSelect } from './procurement-select';
import { pettyBalanceLabel } from './petty-fund-card';
import { formatProcurementDate } from './presentation';

const failure = (error: unknown) =>
  error instanceof Error ? error.message : 'ثبت اطلاعات ناموفق بود.';
export function PettyRegistrationForm({
  branchId,
  onClose,
  onSaved,
}: {
  branchId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [id] = useState(() => crypto.randomUUID());
  const [title, setTitle] = useState(''),
    [date, setDate] = useState(''),
    [amount, setAmount] = useState('');
  const [costCenter, setCostCenter] = useState(''),
    [fee, setFee] = useState('0'),
    [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null),
    [receipt, setReceipt] = useState<
      ProcurementDocumentReferenceV1 | undefined
    >();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const client = useQueryClient();
  const fund = useQuery({
    queryKey: ['procurement', 'petty-fund', branchId],
    queryFn: () =>
      procurementRequest<{ balance: string; currencyCode: string } | null>(
        `/petty-fund?branchId=${encodeURIComponent(branchId)}`,
      ),
    enabled: Boolean(branchId),
  });
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      let proof = receipt;
      if (file && !proof) {
        const { data: options } = await documentsApi.options();
        const type = options.documentTypes.find(
          (item) => item.domain === 'PROCUREMENT',
        );
        const category = options.categories[0];
        if (!type || !category)
          throw new Error(
            'تنظیمات نوع سند خرید، دسته‌بندی یا مالک برای بارگذاری فاکتور کامل نیست.',
          );
        const form = new FormData();
        form.set('file', file);
        form.set('title', `فیش ${title}`.slice(0, 240));
        form.set('documentTypeId', type.id);
        form.set('categoryId', category.id);
        form.set('branchId', branchId);
        form.set('ownerUserId', options.currentUserId);
        form.set('confidentiality', 'INTERNAL');
        form.set('sourceModule', 'PROCUREMENT');
        form.set('sourceEntityType', 'ProcurementPettyRegistration');
        form.set('sourceEntityId', id);
        form.set('sourceDisplayLabel', title);
        const { data } = await documentsApi.upload(form);
        proof = { id: data.id, versionId: data.currentVersion.id };
        setReceipt(proof);
      }
      const input: ProcurementPettyRegistrationInputV1 = {
        id,
        branchId,
        title,
        amount,
        costCenter,
        fee,
        description,
        occurredAt:
          date.length === 10
            ? `${date}T00:00:00.000Z`
            : new Date(date).toISOString(),
        ...(proof ? { receipt: proof } : {}),
      };
      await procurementRequest<ProcurementPettyRegistrationV1>(
        '/petty-registrations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        },
      );
      void client.invalidateQueries({
        queryKey: ['procurement', 'petty-fund'],
      });
      void client.invalidateQueries({
        queryKey: ['procurement', 'registrations'],
      });
      onSaved();
    } catch (cause) {
      setError(failure(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent dir="rtl" className="max-w-2xl">
        <DialogTitle>ثبت جدید</DialogTitle>
        <DialogDescription>ثبت تنخواه</DialogDescription>
        <form className="mt-4 space-y-4" onSubmit={(event) => void save(event)}>
          <fieldset
            disabled={busy}
            className="grid gap-5 rounded-2xl border border-primary/15 bg-primary/5 p-5 sm:grid-cols-2"
          >
            <FormField
              id="petty-registration-title"
              label="عنوان"
              required
              className="sm:col-span-2"
            >
              <Input
                id="petty-registration-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                maxLength={240}
              />
            </FormField>
            <FormField id="petty-registration-date" label="تاریخ" required>
              <DatePicker
                id="petty-registration-date"
                value={date}
                onChange={setDate}
                required
                variant="rubi"
              />
            </FormField>
            <FormField
              id="petty-registration-amount"
              label={`مبلغ کل با کارمزد${fund.data ? ` (${fund.data.currencyCode})` : ''}`}
              required
            >
              <MoneyInput
                id="petty-registration-amount"
                value={amount}
                onValueChange={setAmount}
                required
              />
            </FormField>
            <FormField id="petty-registration-cost-center" label="مرکز هزینه">
              <Input
                id="petty-registration-cost-center"
                value={costCenter}
                onChange={(event) => setCostCenter(event.target.value)}
                maxLength={160}
              />
            </FormField>
            <FormField id="petty-registration-fee" label="کارمزد (جزء مبلغ کل)">
              <MoneyInput
                id="petty-registration-fee"
                value={fee}
                onValueChange={setFee}
              />
            </FormField>
            <FormField
              id="petty-registration-description"
              label="شرح"
              className="sm:col-span-2"
            >
              <Textarea
                id="petty-registration-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={2000}
                rows={3}
              />
            </FormField>
            <FormField
              id="petty-registration-receipt"
              label="فیش"
              className="sm:col-span-2"
            >
              <Input
                id="petty-registration-receipt"
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setReceipt(undefined);
                }}
              />
            </FormField>
          </fieldset>
          {error && (
            <Alert tone="error" title="ثبت ناموفق بود" description={error} />
          )}
          {fund.isError && (
            <Alert
              tone="error"
              title="دریافت تنخواه ناموفق بود"
              description={failure(fund.error)}
            />
          )}{' '}
          {fund.isSuccess && !fund.data && (
            <p role="alert">ابتدا حساب تنخواه این شعبه را تنظیم کنید.</p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              انصراف
            </Button>
            <Button
              type="submit"
              loading={busy}
              disabled={
                busy ||
                !fund.data ||
                fund.isError ||
                !title.trim() ||
                !date ||
                !amount
              }
            >
              ثبت
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function PettyRegistrations({
  bootstrap,
  onBack,
  embedded = false,
  selectedBranchId,
  onBranchChange,
}: {
  bootstrap: Bootstrap;
  onBack: () => void;
  embedded?: boolean;
  selectedBranchId?: string;
  onBranchChange?: (id: string) => void;
}) {
  const [localBranchId, setBranch] = useState(
    bootstrap.defaultBranchId ?? bootstrap.branches[0]?.id ?? '',
  );
  const branchId = selectedBranchId ?? localBranchId;
  const [search, setSearch] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  const [page, setPage] = useState(1),
    [creating, setCreating] = useState(false);
  const query = useQuery({
    queryKey: [
      'procurement',
      'registrations',
      branchId,
      search,
      from,
      to,
      page,
    ],
    queryFn: () =>
      procurementRequest<ProcurementListV1<ProcurementPettyRegistrationV1>>(
        `/petty-registrations?${new URLSearchParams({ branchId, search, from, to, page: String(page) })}`,
      ),
    retry: false,
  });
  return (
    <section className="space-y-5" dir="rtl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">ثبت‌ها</h1>
        <div className="flex gap-2">
          {!embedded && (
            <Button variant="outline" onClick={onBack}>
              بازگشت به میزکار
            </Button>
          )}
          {!embedded &&
            bootstrap.permissions.includes('procurement.request.create') && (
              <Button onClick={() => setCreating(true)}>ثبت جدید</Button>
            )}
        </div>
      </header>
      <Card className="overflow-hidden border-blue-300/70">
        <div className="grid items-end gap-3 border-b bg-gradient-to-l from-blue-400/15 to-transparent p-5 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="عنوان" id="registration-search">
            <Input
              id="registration-search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </FormField>
          <FormField label="شعبه" id="registration-branch">
            <ProcurementSelect
              id="registration-branch"
              value={branchId}
              onChange={(event) => {
                setBranch(event.target.value);
                onBranchChange?.(event.target.value);
                setPage(1);
              }}
            >
              {bootstrap.branches.map((branch) => (
                <option value={branch.id} key={branch.id}>
                  {branch.label}
                </option>
              ))}
            </ProcurementSelect>
          </FormField>
          <MasterDataDateRangeFilter
            title="تاریخ ثبت"
            idPrefix="registration-filter"
            fromDate={from}
            toDate={to}
            onFromDateChange={(value) => {
              setFrom(value.slice(0, 10));
              setPage(1);
            }}
            onToDateChange={(value) => {
              setTo(value.slice(0, 10));
              setPage(1);
            }}
            onReset={() => {
              setFrom('');
              setTo('');
              setPage(1);
            }}
          />
        </div>
        {query.isPending ? (
          <p role="status" className="p-6">
            در حال دریافت…
          </p>
        ) : query.isError ? (
          <div className="p-5">
            <Alert
              tone="error"
              title="دریافت اطلاعات ناموفق بود"
              description={failure(query.error)}
            />
            <Button onClick={() => void query.refetch()} variant="outline">
              تلاش دوباره
            </Button>
          </div>
        ) : query.data.items.length ? (
          <div className="divide-y divide-border">
            {query.data.items.map((row) => (
              <article
                key={row.id}
                className="grid gap-3 border-r-2 border-blue-300 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div>
                  <h2 className="font-semibold text-primary">{row.title}</h2>
                  {row.costCenter && (
                    <p className="mt-1 text-sm">مرکز هزینه: {row.costCenter}</p>
                  )}
                  {row.description && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {row.description}
                    </p>
                  )}
                  {row.fee && row.fee !== '0' && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      کارمزد: {pettyBalanceLabel(row.fee)} {row.currencyCode}
                    </p>
                  )}
                  <p className="mt-2 text-sm text-muted-foreground">
                    {formatProcurementDate(row.occurredAt)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold">
                    {pettyBalanceLabel(row.amount)} {row.currencyCode}
                  </span>
                  {row.receiptDocumentId && (
                    <Link
                      className="text-sm text-primary underline"
                      href={`/documents?document=${encodeURIComponent(row.receiptDocumentId)}`}
                    >
                      مشاهده فیش
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="p-8 text-center text-muted-foreground">
            نتیجه‌ای پیدا نشد
          </p>
        )}
      </Card>
      <nav className="flex items-center justify-between">
        <Button
          variant="outline"
          disabled={page === 1 || query.isFetching}
          onClick={() => setPage((value) => value - 1)}
        >
          قبلی
        </Button>
        <span>{page.toLocaleString('fa-IR')}</span>
        <Button
          variant="outline"
          disabled={!query.data?.hasMore || query.isFetching}
          onClick={() => setPage((value) => value + 1)}
        >
          بعدی
        </Button>
      </nav>
      {creating && (
        <PettyRegistrationForm
          branchId={branchId}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            setPage(1);
          }}
        />
      )}
    </section>
  );
}
