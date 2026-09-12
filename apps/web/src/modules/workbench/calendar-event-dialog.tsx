'use client';

import { useState, type FormEvent } from 'react';
import { CalendarPlus, FileImage, Link2, Paperclip } from 'lucide-react';

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
import { calendarImageError, normalizeCalendarLink } from './calendar-model';

export interface CalendarEventDraft {
  title: string;
  date: string;
  description: string;
  linkUrl: string;
  image: File | null;
}

export function CalendarEventDialog({
  open,
  onOpenChange,
  onCreate,
  initialDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (draft: CalendarEventDraft) => void;
  initialDate: string;
}) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate);
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [error, setError] = useState('');

  function reset() {
    setTitle('');
    setDate(initialDate);
    setDescription('');
    setLink('');
    setImage(null);
    setError('');
  }

  function submit(event: FormEvent<HTMLFormElement>) {
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
    const imageError = calendarImageError(image);
    if (imageError) {
      setError(imageError);
      return;
    }
    onCreate({
      title: title.trim(),
      date,
      description: description.trim(),
      linkUrl: safeLink,
      image,
    });
    reset();
    onOpenChange(false);
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
        <form className="mt-5 space-y-5" onSubmit={submit}>
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
              htmlFor="calendar-event-image"
            >
              <Paperclip aria-hidden="true" className="size-4 text-primary" />
              تصویر رویداد
            </label>
            <Input
              id="calendar-event-image"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                const nextError = calendarImageError(file);
                if (nextError) {
                  setImage(null);
                  setError(nextError);
                  event.target.value = '';
                  return;
                }
                setImage(file);
                setError('');
              }}
            />
            {image ? (
              <div className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2 text-sm">
                <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  <FileImage aria-hidden="true" className="size-5" />
                </span>
                <span className="min-w-0 flex-1 truncate">{image.name}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setImage(null)}
                >
                  حذف
                </Button>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              PNG، JPG، WEBP یا GIF تا حجم ۵ مگابایت
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
            <Button type="submit">
              <CalendarPlus aria-hidden="true" className="size-4" />
              افزودن به تقویم
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
