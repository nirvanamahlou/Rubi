'use client';

import type { DocumentBulkActionV1 } from '@rubi/contracts';
import { ListChecks } from 'lucide-react';
import { useState } from 'react';

import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  FormField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/ui';

export function DocumentBulkActionsDialog({
  count,
  error,
  initialAction,
  onOpenChange,
  onSubmit,
  open,
  submitting,
}: {
  count: number;
  error: string;
  initialAction: DocumentBulkActionV1;
  onOpenChange: (open: boolean) => void;
  onSubmit: (action: DocumentBulkActionV1, reason: string) => Promise<void>;
  open: boolean;
  submitting: boolean;
}) {
  const [action, setAction] = useState<DocumentBulkActionV1>(initialAction);
  const [reason, setReason] = useState('');

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-xl">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-blue-100 text-primary dark:bg-blue-950/40">
            <ListChecks aria-hidden="true" className="size-5" />
          </span>
          <div>
            <DialogTitle>عملیات گروهی</DialogTitle>
            <DialogDescription>
              عملیات روی {count.toLocaleString('fa-IR')} سند انتخاب‌شده اعمال
              می‌شود.
            </DialogDescription>
          </div>
        </div>
        <FormField label="عملیات" required>
          <Select
            disabled={submitting}
            onValueChange={(value) => setAction(value as DocumentBulkActionV1)}
            value={action}
          >
            <SelectTrigger aria-label="نوع عملیات گروهی">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[80]">
              <SelectItem value="MARK_INCOMPLETE">علامت‌گذاری ناقص</SelectItem>
              <SelectItem value="MARK_COMPLETE">علامت‌گذاری کامل</SelectItem>
              <SelectItem value="ARCHIVE">انتقال به آرشیو</SelectItem>
              <SelectItem value="RESTORE">بازیابی از آرشیو</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField id="bulk-action-reason" label="دلیل عملیات" required>
          <Textarea
            id="bulk-action-reason"
            onChange={(event) => setReason(event.target.value)}
            placeholder="دلیل این تغییر را بنویسید"
            value={reason}
          />
        </FormField>
        {error ? (
          <Alert description={error} title="عملیات انجام نشد" tone="error" />
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
            disabled={!count || reason.trim().length < 5 || submitting}
            onClick={() => void onSubmit(action, reason.trim())}
          >
            {submitting ? 'در حال انجام…' : 'اجرای عملیات'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
