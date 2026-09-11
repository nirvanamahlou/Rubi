'use client';

import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  Textarea,
} from '@/components/ui';
import { messageUnits } from './message-templates';

export function NewRequestDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [unit, setUnit] = useState('sales');
  const [priority, setPriority] = useState('normal');
  const [reference, setReference] = useState('');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-w-3xl max-h-[90dvh] overflow-y-auto"
      >
        <DialogTitle>درخواست جدید</DialogTitle>
        <DialogDescription>
          عنوان، شرح و واحد مقصد را مشخص کنید. متن تا زمانی که در همین صفحه
          هستید حفظ می‌شود.
        </DialogDescription>
        <form
          className="mt-5 grid gap-5 sm:grid-cols-2"
          onSubmit={(event) => event.preventDefault()}
        >
          <label className="space-y-2 text-sm font-semibold">
            <span>عنوان درخواست *</span>
            <Input
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="space-y-2 text-sm font-semibold">
            <span>واحد مقصد *</span>
            <select
              className="w-full rounded-xl border border-border bg-surface p-3"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            >
              {messageUnits
                .filter((item) => item.id !== 'ai')
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
            </select>
          </label>
          <label className="space-y-2 text-sm font-semibold sm:col-span-2">
            <span>شرح درخواست *</span>
            <Textarea
              required
              rows={5}
              maxLength={10000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <label className="space-y-2 text-sm font-semibold">
            <span>اولویت</span>
            <select
              className="w-full rounded-xl border border-border bg-surface p-3"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="normal">عادی</option>
              <option value="high">بالا</option>
              <option value="urgent">فوری</option>
            </select>
          </label>
          <label className="space-y-2 text-sm font-semibold">
            <span>مرجع پرونده مرتبط</span>
            <Input
              maxLength={200}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
          <div className="sm:col-span-2">
            <Alert
              title="ثبت درخواست هنوز فعال نیست"
              description="سرویس ثبت و ارجاع درخواست به واحد و مسئول پاسخ‌گو آماده نیست. تکمیل فرم، درخواست را ارسال یا ذخیره نمی‌کند."
            />
          </div>
          <div className="flex gap-3 sm:col-span-2">
            <Button disabled>ثبت درخواست</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              بستن فرم
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
