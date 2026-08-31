'use client';

import { FileUp, FolderKanban, Link2, ShieldCheck } from 'lucide-react';
import type {
  BranchReference,
  DocumentOptionsResponseV1,
} from '@rubi/contracts';
import { useMemo, useState } from 'react';

import {
  Alert,
  Button,
  DatePicker,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/ui';

type Options = DocumentOptionsResponseV1['data'];

const emptyForm = {
  title: '',
  description: '',
  documentTypeId: '',
  categoryId: '',
  branchId: '',
  ownerUserId: '',
  sourceModule: '',
  sourceEntityType: '',
  sourceEntityId: '',
  sourceDisplayLabel: '',
  confidentiality: '',
  validUntil: '',
  versionNote: '',
};

export function DocumentUploadDialog({
  branches,
  error,
  onOpenChange,
  onSubmit,
  open,
  options,
  submitting,
}: {
  branches: readonly BranchReference[];
  error: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (form: FormData) => Promise<void>;
  open: boolean;
  options: Options | null;
  submitting: boolean;
}) {
  const [values, setValues] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);

  const formValues = useMemo(
    () => ({
      ...values,
      documentTypeId:
        values.documentTypeId || options?.documentTypes[0]?.id || '',
      categoryId: values.categoryId || options?.categories[0]?.id || '',
      ownerUserId: values.ownerUserId || options?.owners[0]?.id || '',
      branchId: values.branchId || branches[0]?.id || '',
    }),
    [branches, options, values],
  );

  const selectedType = useMemo(
    () =>
      options?.documentTypes.find(
        (type) => type.id === formValues.documentTypeId,
      ),
    [formValues.documentTypeId, options],
  );

  function update(name: keyof typeof emptyForm, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    const form = new FormData();
    form.set('file', file);
    for (const [name, value] of Object.entries(formValues)) {
      if (value) form.set(name, value);
    }
    await onSubmit(form);
    setValues(emptyForm);
    setFile(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !submitting) {
      setValues(emptyForm);
      setFile(null);
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="max-h-[92dvh] max-w-5xl overflow-y-auto p-0">
        <div className="sticky top-0 z-20 border-b border-border bg-surface px-6 py-5 pe-14">
          <DialogTitle>بارگذاری سند</DialogTitle>
          <DialogDescription>
            کد آرشیو به‌صورت خودکار ساخته می‌شود. فایل ابتدا در فضای خصوصی قرار
            می‌گیرد و فقط پس از تأیید اسکن امنیتی قابل دریافت خواهد بود.
          </DialogDescription>
        </div>
        <form
          className="space-y-6 p-6"
          onSubmit={(event) => void submit(event)}
        >
          <section
            aria-labelledby="upload-file-heading"
            className="rounded-2xl border border-blue-100 bg-blue-50/45 p-4 dark:bg-blue-950/15"
          >
            <div className="flex items-center gap-2">
              <FileUp className="size-5 text-primary" aria-hidden="true" />
              <h3 className="font-black" id="upload-file-heading">
                ۱. انتخاب فایل
              </h3>
            </div>
            <div className="mt-4 rounded-xl border-2 border-dashed border-blue-200 bg-surface p-5 text-center">
              <Input
                accept={options?.uploadPolicy.allowedMimeTypes.join(',')}
                aria-label="فایل سند"
                className="mx-auto max-w-xl cursor-pointer pt-2"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                required
                type="file"
              />
              <p className="mt-3 text-xs text-muted-foreground">
                سقف عمومی:{' '}
                {(
                  (options?.uploadPolicy.maxFileSizeBytes ?? 0) /
                  1024 /
                  1024
                ).toLocaleString('fa-IR')}{' '}
                مگابایت · فایل اجرایی و Macro رد می‌شود.
              </p>
            </div>
          </section>

          <section aria-labelledby="identity-heading">
            <div className="flex items-center gap-2">
              <FolderKanban
                className="size-5 text-primary"
                aria-hidden="true"
              />
              <h3 className="font-black" id="identity-heading">
                ۲. شناسنامه سند
              </h3>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <FormField id="document-title" label="عنوان" required>
                <Input
                  id="document-title"
                  onChange={(event) => update('title', event.target.value)}
                  required
                  value={formValues.title}
                />
              </FormField>
              <FormField label="نوع سند" required>
                <Select
                  onValueChange={(value) => update('documentTypeId', value)}
                  value={formValues.documentTypeId}
                >
                  <SelectTrigger aria-label="نوع سند">
                    <SelectValue placeholder="انتخاب نوع" />
                  </SelectTrigger>
                  <SelectContent>
                    {options?.documentTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="دسته‌بندی" required>
                <Select
                  onValueChange={(value) => update('categoryId', value)}
                  value={formValues.categoryId}
                >
                  <SelectTrigger aria-label="دسته‌بندی">
                    <SelectValue placeholder="انتخاب دسته" />
                  </SelectTrigger>
                  <SelectContent>
                    {options?.categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                label="محرمانگی"
                description="در صورت خالی‌بودن، سیاست نوع سند اعمال می‌شود."
              >
                <Select
                  onValueChange={(value) => update('confidentiality', value)}
                  value={formValues.confidentiality}
                >
                  <SelectTrigger aria-label="محرمانگی">
                    <SelectValue placeholder="سیاست پیش‌فرض نوع سند" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUBLIC">عمومی</SelectItem>
                    <SelectItem value="INTERNAL">داخلی</SelectItem>
                    <SelectItem value="CONFIDENTIAL">محرمانه</SelectItem>
                    <SelectItem value="RESTRICTED">بسیار محدود</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                label="تاریخ اعتبار"
                required={Boolean(selectedType?.requiresExpiry)}
              >
                <DatePicker
                  id="document-valid-until"
                  onChange={(value) => update('validUntil', value)}
                  required={Boolean(selectedType?.requiresExpiry)}
                  value={formValues.validUntil}
                />
              </FormField>
              <FormField id="version-note" label="یادداشت نسخه">
                <Input
                  id="version-note"
                  onChange={(event) =>
                    update('versionNote', event.target.value)
                  }
                  placeholder="مثلاً بارگذاری اولیه"
                  value={formValues.versionNote}
                />
              </FormField>
            </div>
            <FormField id="document-description" label="توضیحات">
              <Textarea
                id="document-description"
                onChange={(event) => update('description', event.target.value)}
                value={formValues.description}
              />
            </FormField>
          </section>

          <section aria-labelledby="relation-heading">
            <div className="flex items-center gap-2">
              <Link2 className="size-5 text-primary" aria-hidden="true" />
              <h3 className="font-black" id="relation-heading">
                ۳. ارتباط با پرونده
              </h3>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <FormField id="source-module" label="ماژول مبدأ" required>
                <Input
                  id="source-module"
                  onChange={(event) =>
                    update('sourceModule', event.target.value)
                  }
                  placeholder="Sales Contracts"
                  required
                  value={formValues.sourceModule}
                />
              </FormField>
              <FormField
                id="source-entity-type"
                label="نوع رکورد مبدأ"
                required
              >
                <Input
                  id="source-entity-type"
                  onChange={(event) =>
                    update('sourceEntityType', event.target.value)
                  }
                  placeholder="sales_contract"
                  required
                  value={formValues.sourceEntityType}
                />
              </FormField>
              <FormField
                id="source-entity-id"
                label="شناسه رکورد مبدأ"
                required
              >
                <Input
                  id="source-entity-id"
                  onChange={(event) =>
                    update('sourceEntityId', event.target.value)
                  }
                  required
                  value={formValues.sourceEntityId}
                />
              </FormField>
              <FormField id="source-label" label="عنوان پرونده" required>
                <Input
                  id="source-label"
                  onChange={(event) =>
                    update('sourceDisplayLabel', event.target.value)
                  }
                  required
                  value={formValues.sourceDisplayLabel}
                />
              </FormField>
            </div>
          </section>

          <section aria-labelledby="ownership-heading">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
              <h3 className="font-black" id="ownership-heading">
                ۴. مالکیت و کنترل‌ها
              </h3>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <FormField label="شعبه" required>
                <Select
                  onValueChange={(value) => update('branchId', value)}
                  value={formValues.branchId}
                >
                  <SelectTrigger aria-label="شعبه">
                    <SelectValue placeholder="انتخاب شعبه" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="مالک فایل" required>
                <Select
                  onValueChange={(value) => update('ownerUserId', value)}
                  value={formValues.ownerUserId}
                >
                  <SelectTrigger aria-label="مالک فایل">
                    <SelectValue placeholder="انتخاب مالک" />
                  </SelectTrigger>
                  <SelectContent>
                    {options?.owners.map((owner) => (
                      <SelectItem key={owner.id} value={owner.id}>
                        {owner.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <Alert
              className="mt-4"
              description={
                options?.uploadPolicy.antivirusAvailable
                  ? 'موتور امنیتی فعال است؛ فایل پس از بارگذاری فوراً اسکن می‌شود و فقط نتیجه پاک اجازه دریافت می‌گیرد.'
                  : 'موتور امنیتی در این محیط فعال نیست؛ فایل خصوصی می‌ماند و تا انجام بررسی امنیتی قابل دریافت نخواهد بود.'
              }
              title={
                options?.uploadPolicy.antivirusAvailable
                  ? 'اسکن امنیتی فعال'
                  : 'حفاظت تا زمان بررسی امنیتی'
              }
              tone={
                options?.uploadPolicy.antivirusAvailable ? 'info' : 'warning'
              }
            />
          </section>

          {error ? (
            <Alert
              description={error}
              title="بارگذاری ناموفق بود"
              tone="error"
            />
          ) : null}
          <div className="sticky bottom-0 flex justify-end gap-3 border-t border-border bg-surface py-4">
            <Button
              disabled={submitting}
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="ghost"
            >
              انصراف
            </Button>
            <Button disabled={submitting || !file || !options} type="submit">
              {submitting
                ? 'در حال ارسال و اسکن امن…'
                : options?.uploadPolicy.antivirusAvailable
                  ? 'بارگذاری و اسکن امن'
                  : 'بارگذاری با حفاظت امنیتی'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
