'use client';

import { useState, type FormEvent } from 'react';
import { CalendarPlus, FileText, Link2, Paperclip } from 'lucide-react';

import {
  Alert,
  Button,
  DatePicker,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  Textarea,
} from '@/components/ui';
import {
  calendarAttachmentError,
  normalizeCalendarLink,
} from './calendar-model';

export interface CalendarEventDraft {
  title: string;
  date: string;
  description: string;
  linkUrl: string;
  attachment: File | null;
}

export function CalendarEventDialog({
  open,
  onOpenChange,
  onCreate,
  initialDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (draft: CalendarEventDraft) => void | Promise<void>;
  initialDate: string;
}) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate);
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  function reset() {
    setTitle('');
    setDate(initialDate);
    setDescription('');
    setLink('');
    setAttachment(null);
    setError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const safeLink = normalizeCalendarLink(link);
    if (!title.trim()) {
      setError('عنوان رویداد را وارد کنید.');
      return;
    }
    if (!date) {
      setError('تاریخ رویداد را انتخاب کنید.');
      return;
    }
    if (safeLink === null) {
      setError('لینک باید با http یا https شروع شود.');
      return;
    }
    const attachmentError = calendarAttachmentError(attachment);
    if (attachmentError) {
      setError(attachmentError);
      return;
    }
    setPending(true);
    try {
      await onCreate({
        title: title.trim(),
        date,
        description: description.trim(),
        linkUrl: safeLink,
        attachment,
      });
      reset();
      onOpenChange(false);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'ذخیره رویداد انجام نشد.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent
        dir="rtl"
        className="max-h-[90vh] max-w-2xl overflow-y-auto"
      >
        <DialogTitle className="flex items-center gap-2 pe-10">
          <CalendarPlus aria-hidden="true" className="size-5 text-primary" />
          افزودن رویداد
        </DialogTitle>
        <DialogDescription>
          تاریخ، توضیحات و پیوست‌های رویداد را وارد کنید.
        </DialogDescription>
        <form
          className="mt-5 space-y-5"
          onSubmit={(event) => void submit(event)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label
              className="space-y-2 text-sm font-semibold"
              htmlFor="calendar-event-title"
            >
              <span>عنوان رویداد *</span>
              <Input
                id="calendar-event-title"
                value={title}
                maxLength={120}
                autoFocus
                onChange={(event) => {
                  setTitle(event.target.value);
                  setError('');
                }}
                placeholder="مثلاً جلسه بررسی قرارداد"
              />
            </label>
            <label
              className="space-y-2 text-sm font-semibold"
              htmlFor="calendar-event-date"
            >
              <span>تاریخ رویداد *</span>
              <DatePicker
                id="calendar-event-date"
                value={date}
                required
                withinDialog
                onChange={(value) => {
                  setDate(value);
                  setError('');
                }}
                placeholder="انتخاب تاریخ"
              />
            </label>
          </div>
          <label
            className="block space-y-2 text-sm font-semibold"
            htmlFor="calendar-event-description"
          >
            <span>متن رویداد</span>
            <Textarea
              id="calendar-event-description"
              value={description}
              rows={5}
              maxLength={2000}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="توضیحات، دستور جلسه یا نکات لازم را بنویسید…"
            />
          </label>
          <label
            className="block space-y-2 text-sm font-semibold"
            htmlFor="calendar-event-link"
          >
            <span className="flex items-center gap-2">
              <Link2 aria-hidden="true" className="size-4 text-primary" />
              لینک مرتبط
            </span>
            <Input
              id="calendar-event-link"
              dir="ltr"
              inputMode="url"
              value={link}
              maxLength={1000}
              onChange={(event) => {
                setLink(event.target.value);
                setError('');
              }}
              placeholder="https://example.com"
            />
          </label>
          <section className="space-y-3 rounded-2xl border border-primary/15 bg-primary/5 p-4">
            <label
              className="flex items-center gap-2 text-sm font-semibold"
              htmlFor="calendar-event-attachment"
            >
              <Paperclip aria-hidden="true" className="size-4 text-primary" />
              سند یا تصویر رویداد
            </label>
            <Input
              id="calendar-event-attachment"
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                const nextError = calendarAttachmentError(file);
                if (nextError) {
                  setAttachment(null);
                  setError(nextError);
                  event.target.value = '';
                  return;
                }
                setAttachment(file);
                setError('');
              }}
            />
            {attachment ? (
              <div className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2 text-sm">
                <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  <FileText aria-hidden="true" className="size-5" />
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {attachment.name}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setAttachment(null)}
                >
                  حذف
                </Button>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              PDF، PNG یا JPG تا حجم ۱۰ مگابایت
            </p>
          </section>
          {error ? <Alert tone="error" title={error} /> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              انصراف
            </Button>
            <Button type="submit" disabled={pending}>
              <CalendarPlus aria-hidden="true" className="size-4" />
              {pending ? 'در حال ذخیره…' : 'افزودن به تقویم'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
