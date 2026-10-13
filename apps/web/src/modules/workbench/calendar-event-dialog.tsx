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
  calendarStatusOptions,
  normalizeCalendarLink,
  tehranDay,
  type CalendarEntry,
  type CalendarStatus,
} from './calendar-model';
import { WorkbenchSelect } from './workbench-select';

export interface CalendarEventDraft {
  title: string;
  date: string;
  description: string;
  linkUrl: string;
  attachment: File | null;
  status: CalendarStatus;
}

export function CalendarEventDialog({
  open,
  onOpenChange,
  onSave,
  initialDate,
  editingEvent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: CalendarEventDraft) => void | Promise<void>;
  initialDate: string;
  editingEvent?: CalendarEntry | null;
}) {
  const [title, setTitle] = useState(editingEvent?.title ?? '');
  const [date, setDate] = useState(
    editingEvent?.dueAt
      ? (tehranDay(editingEvent.dueAt) ?? initialDate)
      : initialDate,
  );
  const [description, setDescription] = useState(
    editingEvent?.description ?? '',
  );
  const [link, setLink] = useState(editingEvent?.linkUrl ?? '');
  const [status, setStatus] = useState<CalendarStatus>(
    editingEvent?.status ?? 'planned',
  );
  const [attachment, setAttachment] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  function reset() {
    setTitle(editingEvent?.title ?? '');
    setDate(
      editingEvent?.dueAt
        ? (tehranDay(editingEvent.dueAt) ?? initialDate)
        : initialDate,
    );
    setDescription(editingEvent?.description ?? '');
    setLink(editingEvent?.linkUrl ?? '');
    setStatus(editingEvent?.status ?? 'planned');
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
      await onSave({
        title: title.trim(),
        date,
        description: description.trim(),
        linkUrl: safeLink,
        attachment,
        status,
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
          {editingEvent ? 'ویرایش رویداد' : 'افزودن رویداد'}
        </DialogTitle>
        <DialogDescription>
          {editingEvent
            ? 'اطلاعات و وضعیت رویداد را ویرایش کنید.'
            : 'تاریخ، توضیحات و پیوست‌های رویداد را وارد کنید.'}
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
          <div className="space-y-2 text-sm font-semibold">
            <span>وضعیت رویداد</span>
            <WorkbenchSelect
              label="وضعیت رویداد"
              value={status}
              onValueChange={(value) => setStatus(value as CalendarStatus)}
              options={calendarStatusOptions}
            />
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
            {editingEvent?.imageDocumentId && !attachment ? (
              <p className="text-xs text-muted-foreground">
                پیوست فعلی حفظ می‌شود؛ برای جایگزینی، فایل تازه‌ای انتخاب کنید.
              </p>
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
              {pending
                ? 'در حال ذخیره…'
                : editingEvent
                  ? 'ذخیره تغییرات'
                  : 'افزودن به تقویم'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
