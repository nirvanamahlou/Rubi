'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
} from '@/components/ui';

export function PasswordChange() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <KeyRound className="size-4" aria-hidden="true" />
        تغییر رمز عبور
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
          dir="rtl"
        >
          <DialogTitle className="pe-10">تغییر رمز عبور</DialogTitle>
          <DialogDescription>
            برای تغییر رمز حساب، رمز فعلی و رمز جدید و تکرار آن لازم است.
          </DialogDescription>
          <Alert
            tone="info"
            title="تغییر رمز هنوز فعال نیست"
            description="سرویس تغییر رمز حساب هنوز آماده نیست. تا فعال‌شدن آن، ورود و ثبت رمز در این فرم غیرفعال است."
          />
          <fieldset
            disabled
            className="space-y-4"
            aria-label="اطلاعات تغییر رمز عبور"
          >
            <div className="space-y-2">
              <label
                htmlFor="workbench-current-password"
                className="block text-sm font-semibold"
              >
                رمز عبور فعلی
              </label>
              <Input
                id="workbench-current-password"
                type="password"
                autoComplete="current-password"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="workbench-new-password"
                className="block text-sm font-semibold"
              >
                رمز عبور جدید
              </label>
              <Input
                id="workbench-new-password"
                type="password"
                autoComplete="new-password"
                dir="ltr"
                aria-describedby="workbench-password-policy"
              />
              <p
                id="workbench-password-policy"
                className="text-xs leading-6 text-muted-foreground"
              >
                حداقل ۱۰ نویسه، شامل حرف بزرگ و کوچک لاتین، عدد و نویسهٔ ویژه.
              </p>
            </div>
            <div className="space-y-2">
              <label
                htmlFor="workbench-confirm-password"
                className="block text-sm font-semibold"
              >
                تکرار رمز عبور جدید
              </label>
              <Input
                id="workbench-confirm-password"
                type="password"
                autoComplete="new-password"
                dir="ltr"
              />
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <Button disabled>ثبت رمز جدید</Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              بستن
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
