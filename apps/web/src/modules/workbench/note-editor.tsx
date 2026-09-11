'use client';

import { useState } from 'react';
import { LockKeyhole, Save } from 'lucide-react';
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
import type { NoteDraft } from './note-drafts';

export function NoteEditor({
  open,
  onOpenChange,
  initial,
  folders = ['شخصی', 'جلسات', 'ایده‌ها'],
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: NoteDraft | undefined;
  folders?: string[];
  onApply?: (draft: NoteDraft) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [folder, setFolder] = useState(initial?.folder ?? 'شخصی');
  const [tags, setTags] = useState(initial?.tags ?? '');
  const [discard, setDiscard] = useState(false);
  const [items, setItems] = useState<{ text: string; done: boolean }[]>(
    initial?.items ?? [],
  );
  const [itemText, setItemText] = useState('');
  const dirty = Boolean(title || body || items.length || itemText);
  function close() {
    if (dirty) setDiscard(true);
    else onOpenChange(false);
  }
  function discardDraft() {
    setTitle('');
    setBody('');
    setItems([]);
    setItemText('');
    setDiscard(false);
    onOpenChange(false);
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (value) onOpenChange(true);
        else close();
      }}
    >
      <DialogContent
        className="max-h-[90dvh] max-w-2xl overflow-y-auto"
        dir="rtl"
      >
        <DialogTitle className="pe-10">
          {initial ? 'ویرایش یادداشت' : 'یادداشت جدید'}
        </DialogTitle>
        <DialogDescription>
          عنوان و متن یادداشت شخصی خود را وارد کنید.
        </DialogDescription>
        {discard ? (
          <div className="mt-5 space-y-5">
            <Alert
              tone="warning"
              title="یادداشت ذخیره نشده است"
              description="با بستن فرم، عنوان و متن واردشده حذف می‌شوند."
            />
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setDiscard(false)}>ادامه نوشتن</Button>
              <Button variant="outline" onClick={discardDraft}>
                بستن بدون ذخیره
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="mt-5 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (
                !title.trim() ||
                (!body.trim() && !items.length) ||
                itemText.trim()
              )
                return;
              onApply?.({
                id: initial?.id ?? crypto.randomUUID(),
                title: title.trim(),
                body,
                folder,
                tags,
                items,
                pinned: initial?.pinned ?? false,
                updatedAt: new Date().toISOString(),
                template: false,
              });
            }}
          >
            <Alert
              tone="warning"
              title="ذخیره یادداشت هنوز در دسترس نیست"
              description="اعمال تغییرات، کارت پیش‌نویس همین صفحه را به‌روز می‌کند؛ در حساب ذخیره نمی‌شود و با بارگذاری مجدد از بین می‌رود."
            />
            <div className="space-y-2">
              <p className="text-sm font-semibold">شروع از قالب یادداشت</p>
              <div className="flex flex-wrap gap-2">
                {[
                  [
                    'چک‌لیست روزانه',
                    [
                      'مرور درخواست‌های باز',
                      'پیگیری پاسخ واحد مالی',
                      'هماهنگی با رزرواسیون',
                    ],
                  ],
                  [
                    'نکات جلسه فروش',
                    [
                      'ثبت تصمیم‌های جلسه',
                      'مشخص‌کردن مسئول پیگیری',
                      'تعیین موعد اقدام بعدی',
                    ],
                  ],
                  [
                    'تحویل پرونده',
                    [
                      'بررسی کامل‌بودن مدارک',
                      'کنترل اطلاعات قرارداد',
                      'تأیید تحویل به واحد مقصد',
                    ],
                  ],
                ].map(([label, lines]) => (
                  <Button
                    key={label as string}
                    type="button"
                    variant="outline"
                    disabled={dirty}
                    onClick={() => {
                      setTitle(label as string);
                      setItems(
                        (lines as string[]).map((text) => ({
                          text,
                          done: false,
                        })),
                      );
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                قالب‌ها نمونهٔ قابل ویرایش‌اند و یادداشت ذخیره‌شده نیستند.
              </p>
            </div>
            <div className="space-y-2">
              <label
                htmlFor="workbench-note-title"
                className="block text-sm font-semibold"
              >
                عنوان یادداشت{' '}
                <span aria-hidden="true" className="text-destructive">
                  *
                </span>
              </label>
              <Input
                id="workbench-note-title"
                name="title"
                required
                maxLength={200}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="عنوان کوتاه و مشخص"
                autoComplete="off"
                aria-describedby="workbench-note-title-count"
              />
              <p
                id="workbench-note-title-count"
                className="text-xs text-muted-foreground"
              >
                {title.length.toLocaleString('fa-IR')} از ۲۰۰ نویسه
              </p>
            </div>
            <div className="space-y-2">
              <label
                htmlFor="workbench-note-body"
                className="block text-sm font-semibold"
              >
                متن یادداشت{' '}
                <span aria-hidden="true" className="text-destructive">
                  *
                </span>
              </label>
              <Textarea
                id="workbench-note-body"
                name="body"
                required={!items.length}
                maxLength={10000}
                rows={8}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="یادداشت خود را اینجا بنویسید…"
                className="min-h-48 leading-8"
                aria-describedby="workbench-note-body-count"
              />
              <p
                id="workbench-note-body-count"
                className="text-xs text-muted-foreground"
              >
                {body.length.toLocaleString('fa-IR')} از ۱۰٬۰۰۰ نویسه
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-semibold">
                پوشه
                <select
                  className="w-full rounded-xl border border-border bg-surface p-3"
                  value={folder}
                  onChange={(event) => setFolder(event.target.value)}
                >
                  {folders.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm font-semibold">
                برچسب‌ها
                <Input
                  maxLength={200}
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                />
              </label>
            </div>
            <section
              className="space-y-3 rounded-xl border border-border p-4"
              aria-label="چک‌لیست یادداشت"
            >
              <h3 className="font-semibold">چک‌لیست</h3>
              {items.map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <label className="flex flex-1 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={(e) =>
                        setItems((current) =>
                          current.map((row, i) =>
                            i === index
                              ? { ...row, done: e.target.checked }
                              : row,
                          ),
                        )
                      }
                      className="size-5 accent-primary"
                    />
                    <span
                      className={
                        item.done ? 'text-muted-foreground line-through' : ''
                      }
                    >
                      {item.text}
                    </span>
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`حذف مورد ${item.text}`}
                    onClick={() =>
                      setItems((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                  >
                    حذف
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  aria-label="مورد جدید چک‌لیست"
                  maxLength={300}
                  placeholder="یک مورد جدید…"
                  value={itemText}
                  onChange={(e) => setItemText(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={!itemText.trim() || items.length >= 50}
                  onClick={() => {
                    setItems((current) => [
                      ...current,
                      { text: itemText.trim(), done: false },
                    ]);
                    setItemText('');
                  }}
                >
                  افزودن
                </Button>
              </div>
            </section>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <LockKeyhole className="size-4 shrink-0" aria-hidden="true" />
              یادداشت شخصی؛ گزینه‌ای برای اشتراک با دیگران ندارد.
            </p>
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <Button
                type="submit"
                disabled={
                  !onApply ||
                  !title.trim() ||
                  (!body.trim() && !items.length) ||
                  Boolean(itemText.trim())
                }
                aria-describedby="workbench-note-save-status"
              >
                <Save className="size-4" aria-hidden="true" />
                اعمال در پیش‌نویس
              </Button>
              <Button type="button" variant="outline" onClick={close}>
                انصراف
              </Button>
              <span
                id="workbench-note-save-status"
                className="text-xs text-muted-foreground"
              >
                {itemText.trim()
                  ? 'مورد نوشته‌شده را به چک‌لیست اضافه یا پاک کنید.'
                  : 'پیش‌نویس در حساب ذخیره نمی‌شود.'}
              </span>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
