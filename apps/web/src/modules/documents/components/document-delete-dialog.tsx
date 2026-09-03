'use client';

import type { DocumentListItemV1 } from '@rubi/contracts';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  FormField,
  Input,
  Textarea,
} from '@/components/ui';

export function DocumentDeleteDialog({
  document,
  error,
  onConfirm,
  onOpenChange,
  open,
  submitting,
}: {
  document: DocumentListItemV1;
  error: string;
  onConfirm: (reason: string) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  submitting: boolean;
}) {
  const [confirmation, setConfirmation] = useState('');
  const [reason, setReason] = useState('');
  const confirmed = confirmation.trim() === document.archiveCode;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-xl">
        <div className="flex items-center gap-3 text-red-700 dark:text-red-300">
          <span className="grid size-11 place-items-center rounded-xl bg-red-100 dark:bg-red-950/40">
            <Trash2 aria-hidden="true" className="size-5" />
          </span>
          <div>
            <DialogTitle>حذف دائمی سند</DialogTitle>
            <DialogDescription>
              رکورد، نسخه‌ها، تاریخچه و فایل ذخیره‌شده قابل بازیابی نخواهند بود.
            </DialogDescription>
          </div>
        </div>
        <Alert
          description={`برای تأیید، کد ${document.archiveCode} را دقیق وارد کنید.`}
          title={`حذف «${document.title}»`}
          tone="error"
        />
        <FormField id="delete-document-reason" label="دلیل حذف" required>
          <Textarea
            id="delete-document-reason"
            onChange={(event) => setReason(event.target.value)}
            placeholder="دلیل حذف دائمی را بنویسید"
            value={reason}
          />
        </FormField>
        <FormField id="delete-document-confirmation" label="کد آرشیو" required>
          <Input
            dir="ltr"
            id="delete-document-confirmation"
            onChange={(event) => setConfirmation(event.target.value)}
            value={confirmation}
          />
        </FormField>
        {error ? (
          <Alert description={error} title="حذف انجام نشد" tone="error" />
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            disabled={submitting}
            onClick={() => onOpenChange(false)}
            variant="ghost"
          >
            انصراف
          </Button>
          <Button
            className="bg-red-600 text-white hover:bg-red-700"
            disabled={!confirmed || reason.trim().length < 5 || submitting}
            onClick={() => void onConfirm(reason.trim())}
          >
            <Trash2 aria-hidden="true" className="size-4" />
            {submitting ? 'در حال حذف…' : 'حذف دائمی'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
