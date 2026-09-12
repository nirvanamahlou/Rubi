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

export function NoteEditor({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [discard, setDiscard] = useState(false);
  const dirty = Boolean(title || body);
  function close() {
    if (dirty) setDiscard(true);
    else onOpenChange(false);
  }
  function discardDraft() {
    setTitle('');
    setBody('');
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
        <DialogTitle className="pe-10">یادداشت جدید</DialogTitle>
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
            onSubmit={(event) => event.preventDefault()}
          >
            <Alert
              tone="warning"
              title="ذخیره یادداشت هنوز در دسترس نیست"
              description="می‌توانید فرم را تکمیل کنید، اما متن فعلاً ذخیره نمی‌شود و با خروج از صفحه از بین می‌رود. پس از فعال‌شدن ذخیره‌سازی خصوصی، ثبت یادداشت در حساب شما ممکن می‌شود."
            />
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
                required
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
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <LockKeyhole className="size-4 shrink-0" aria-hidden="true" />
              یادداشت شخصی؛ گزینه‌ای برای اشتراک با دیگران ندارد.
            </p>
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <Button
                type="submit"
                disabled
                aria-describedby="workbench-note-save-status"
              >
                <Save className="size-4" aria-hidden="true" />
                ثبت یادداشت
              </Button>
              <Button type="button" variant="outline" onClick={close}>
                انصراف
              </Button>
              <span
                id="workbench-note-save-status"
                className="text-xs text-muted-foreground"
              >
                ثبت تا آماده‌شدن ذخیره‌سازی خصوصی غیرفعال است.
              </span>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
