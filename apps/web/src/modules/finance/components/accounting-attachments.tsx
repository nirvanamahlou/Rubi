'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  AccountingSnapshotV1,
  AccountingJournalV1,
} from '@nora/contracts';
import { documentsApi } from '@/modules/documents/api/client';
import { useAccessPermissions } from '@/modules/iam/access-context';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form-controls';
import { SearchCombobox } from '@/components/ui/search-combobox';
import Link from '@/components/access-link';
export function AccountingAttachments({
  book,
  journal,
}: {
  book: AccountingSnapshotV1;
  journal: AccountingJournalV1;
}) {
  const permissions = useAccessPermissions() ?? [];
  const canRead =
      permissions.includes('documents.list') &&
      permissions.includes('documents.finance.read'),
    canUpload =
      permissions.includes('documents.upload') &&
      permissions.includes('documents.finance.read');
  const [typeId, setType] = useState(''),
    [title, setTitle] = useState(''),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const options = useQuery({
    queryKey: ['accounting', 'attachment-options'],
    queryFn: documentsApi.options,
    enabled: canUpload,
  });
  const list = useQuery({
    queryKey: ['accounting', 'attachments', book.book.id, journal.id],
    queryFn: () =>
      documentsApi.list({
        domain: 'FINANCE',
        branchId: book.book.branchId,
        sourceModule: 'FINANCE',
        sourceEntityType: 'AccountingJournal',
        sourceEntityId: journal.id,
        pageSize: 100,
      }),
    enabled: canRead,
  });
  const types =
    options.data?.data.documentTypes.filter(
      (t) =>
        t.domain === 'FINANCE' &&
        ['PUBLIC', 'INTERNAL'].includes(t.defaultConfidentiality) &&
        !t.requiresExpiry,
    ) ?? [];
  const upload = async () => {
    setError('');
    const type = types.find((t) => t.id === typeId),
      opts = options.data?.data;
    if (!type || !opts || !file || !title.trim()) {
      setError('عنوان، نوع پیوست و فایل را انتخاب کنید.');
      return;
    }
    if (
      file.size >
      Math.min(type.maxFileSizeBytes, opts.uploadPolicy.maxFileSizeBytes)
    ) {
      setError('حجم فایل بیش از حد مجاز است.');
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.set('file', file);
      body.set('title', title.trim());
      body.set('documentTypeId', type.id);
      body.set('branchId', book.book.branchId);
      body.set('ownerUserId', opts.currentUserId);
      body.set('confidentiality', type.defaultConfidentiality);
      body.set('sourceModule', 'FINANCE');
      body.set('sourceEntityType', 'AccountingJournal');
      body.set('sourceEntityId', journal.id);
      body.set(
        'sourceDisplayLabel',
        `سند حسابداری ${journal.number ?? journal.id}`,
      );
      await documentsApi.upload(body);
      setTitle('');
      setFile(null);
      await list.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'بارگذاری پیوست ناموفق بود.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h4 className="font-bold">پیوست‌های سند</h4>
      <p className="text-sm text-muted-foreground">
        فایل‌ها در آرشیو اسناد با مجوز مستقل نگهداری می‌شوند. دسترسی به محتوای
        فایل تابع بررسی امنیتی آرشیو است.
      </p>
      {!canRead ? (
        <p>برای مشاهده پیوست‌ها به مجوز آرشیو مالی نیاز دارید.</p>
      ) : null}
      {list.isPending && canRead ? <p role="status">در حال بارگذاری…</p> : null}
      {list.error || options.error ? (
        <p role="alert" className="text-destructive">
          {list.error?.message ?? options.error?.message}
        </p>
      ) : null}
      {list.data?.data.map((d) => (
        <div key={d.id} className="flex flex-wrap justify-between gap-3">
          <Link
            className="text-primary"
            href={`/documents?document=${d.id}&returnTo=${encodeURIComponent(`/finance/accounting/general-ledger/documents/list?bookId=${book.book.id}&journalId=${journal.id}`)}`}
          >
            {d.title} · {d.archiveCode}
          </Link>
          <span>
            {d.currentVersion.scanStatus === 'CLEAN'
              ? 'بررسی‌شده'
              : 'منتظر بررسی آرشیو'}
          </span>
        </div>
      ))}
      {canUpload && journal.status === 'DRAFT' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="عنوان پیوست">
            <Input
              aria-label="عنوان پیوست"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </FormField>
          <FormField label="نوع پیوست">
            <SearchCombobox
              label="نوع پیوست"
              value={typeId}
              onValueChange={setType}
              options={types.map((t) => ({ value: t.id, label: t.name }))}
            />
          </FormField>
          <FormField label="فایل پیوست">
            <Input
              aria-label="فایل پیوست"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </FormField>
          <div>
            <Button
              permission="documents.upload"
              type="button"
              disabled={busy || !types.length}
              onClick={() => void upload()}
            >
              بارگذاری پیوست
            </Button>
          </div>
          {!types.length && !options.isPending ? (
            <p className="text-sm">
              نوع سند مالی قابل بارگذاری باید در آرشیو تعریف شود.
            </p>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
