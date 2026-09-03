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
  const [validationError, setValidationError] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedReason = reason.trim();
    if (!count) {
      setValidationError('حداقل یک سند را انتخاب کنید.');
      return;
    }
    if (normalizedReason.length < 5) {
      setValidationError('دلیل عملیات را با حداقل ۵ نویسه وارد کنید.');
      return;
    }
    setValidationError('');
    await onSubmit(action, normalizedReason);
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-xl">
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
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
              onValueChange={(value) => {
                setValidationError('');
                setAction(value as DocumentBulkActionV1);
              }}
              value={action}
            >
              <SelectTrigger aria-label="نوع عملیات گروهی">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[80]">
                <SelectItem value="MARK_INCOMPLETE">
                  علامت‌گذاری ناقص
                </SelectItem>
                <SelectItem value="MARK_COMPLETE">علامت‌گذاری کامل</SelectItem>
                <SelectItem value="ARCHIVE">انتقال به آرشیو</SelectItem>
                <SelectItem value="RESTORE">بازیابی از آرشیو</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField id="bulk-action-reason" label="دلیل عملیات" required>
            <Textarea
              id="bulk-action-reason"
              onChange={(event) => {
                setValidationError('');
                setReason(event.target.value);
              }}
              placeholder="دلیل این تغییر را بنویسید (حداقل ۵ نویسه)"
              value={reason}
            />
          </FormField>
          {validationError || error ? (
            <Alert
              description={validationError || error}
              title="عملیات انجام نشد"
              tone="error"
            />
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              disabled={submitting}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="ghost"
            >
              انصراف
            </Button>
            <Button disabled={submitting} type="submit">
              {submitting ? 'در حال انجام…' : 'اجرای عملیات'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
