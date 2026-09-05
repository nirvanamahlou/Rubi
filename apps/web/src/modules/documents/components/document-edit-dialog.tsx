'use client';

import type {
  DocumentDetailV1,
  DocumentOptionsResponseV1,
  DocumentUpdateInputV1,
} from '@rubi/contracts';
import { FilePenLine } from 'lucide-react';
import { useState } from 'react';

import {
  Alert,
  Button,
  Checkbox,
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

export function DocumentEditDialog({
  document,
  error,
  onOpenChange,
  onSubmit,
  open,
  options,
  submitting,
}: {
  document: DocumentDetailV1;
  error: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: DocumentUpdateInputV1) => Promise<boolean>;
  open: boolean;
  options: Options | null;
  submitting: boolean;
}) {
  const [values, setValues] = useState<DocumentUpdateInputV1>({
    title: document.title,
    description: document.description ?? '',
    categoryId: document.category?.id ?? '',
    ownerUserId: document.owner.id,
    confidentiality: document.confidentiality,
    validUntil: document.validUntil?.slice(0, 10) ?? '',
    isIncomplete: document.isIncomplete,
    version: document.version,
  });
  const [validationError, setValidationError] = useState('');

  function update<K extends keyof DocumentUpdateInputV1>(
    key: K,
    value: DocumentUpdateInputV1[K],
  ) {
    setValidationError('');
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (values.title.trim().length < 2) {
      setValidationError('عنوان سند را کامل وارد کنید.');
      return;
    }
    if (!values.categoryId || !values.ownerUserId) {
      setValidationError('دسته‌بندی و مالک فایل الزامی هستند.');
      return;
    }
    const description = values.description?.trim();
    const validUntil = values.validUntil?.trim();
    await onSubmit({
      title: values.title.trim(),
      categoryId: values.categoryId,
      ownerUserId: values.ownerUserId,
      confidentiality: values.confidentiality,
      isIncomplete: values.isIncomplete,
      version: values.version,
      description: description ?? '',
      validUntil: validUntil ?? '',
    });
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto p-0">
        <div className="border-b border-sky-200 bg-gradient-to-l from-sky-50 via-white to-blue-50 px-6 py-5 pe-14 dark:border-sky-400/20 dark:from-sky-950/60 dark:via-surface dark:to-blue-950/40">
          <div className="flex items-center gap-2">
            <FilePenLine aria-hidden="true" className="size-5 text-primary" />
            <DialogTitle>ویرایش سند</DialogTitle>
          </div>
          <DialogDescription>
            فایل و نسخه تغییر نمی‌کنند؛ فقط اطلاعات قابل ویرایش سند ذخیره
            می‌شود.
          </DialogDescription>
        </div>
        <form
          className="space-y-5 p-6"
          onSubmit={(event) => void submit(event)}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <FormField id="edit-document-title" label="عنوان" required>
              <Input
                id="edit-document-title"
                onChange={(event) => update('title', event.target.value)}
                value={values.title}
              />
            </FormField>
            <FormField label="دسته‌بندی" required>
              <Select
                disabled={submitting}
                onValueChange={(value) => update('categoryId', value)}
                value={values.categoryId}
              >
                <SelectTrigger aria-label="دسته‌بندی سند">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[80] max-h-72">
                  {options?.categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="مالک فایل" required>
              <Select
                disabled={submitting}
                onValueChange={(value) => update('ownerUserId', value)}
                value={values.ownerUserId}
              >
                <SelectTrigger aria-label="مالک فایل">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[80] max-h-72">
                  {options?.owners.map((owner) => (
                    <SelectItem key={owner.id} value={owner.id}>
                      {owner.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="محرمانگی" required>
              <Select
                disabled={submitting}
                onValueChange={(value) =>
                  update(
                    'confidentiality',
                    value as DocumentUpdateInputV1['confidentiality'],
                  )
                }
                value={values.confidentiality}
              >
                <SelectTrigger aria-label="محرمانگی سند">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[80]">
                  <SelectItem value="PUBLIC">عمومی</SelectItem>
                  <SelectItem value="INTERNAL">داخلی</SelectItem>
                  <SelectItem value="CONFIDENTIAL">محرمانه</SelectItem>
                  <SelectItem value="RESTRICTED">بسیار محدود</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="تاریخ اعتبار">
              <DatePicker
                id="edit-document-valid-until"
                onChange={(value) => update('validUntil', value)}
                required={false}
                value={values.validUntil ?? ''}
              />
            </FormField>
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-400/20 dark:bg-amber-950/20">
              <Checkbox
                aria-label="علامت‌گذاری سند به‌عنوان ناقص"
                checked={values.isIncomplete}
                onCheckedChange={(checked) =>
                  update('isIncomplete', checked === true)
                }
              />
              <div>
                <p className="text-sm font-black">مدرک ناقص است</p>
                <p className="text-xs text-muted-foreground">
                  سند در بخش «مدارک ناقص و منقضی» نمایش داده می‌شود.
                </p>
              </div>
            </div>
          </div>
          <FormField id="edit-document-description" label="توضیحات">
            <Textarea
              id="edit-document-description"
              onChange={(event) => update('description', event.target.value)}
              value={values.description ?? ''}
            />
          </FormField>
          {validationError || error ? (
            <Alert
              description={validationError || error}
              title="ویرایش ذخیره نشد"
              tone="error"
            />
          ) : null}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button
              disabled={submitting}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="ghost"
            >
              انصراف
            </Button>
            <Button disabled={submitting} type="submit">
              {submitting ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
