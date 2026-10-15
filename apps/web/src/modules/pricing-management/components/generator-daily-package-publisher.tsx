'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import Link from '@/i18n/link';
import type { WorkbenchDailyPackageOptionsV1 } from '@nora/contracts';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
} from '@/components/ui';
import { WorkbenchSelect } from '@/modules/workbench/workbench-select';
import { workbenchPersonalApi } from '@/modules/workbench/workbench-personal-api';
import {
  dailyPackageEvent,
  type DailyPackageMessage,
} from '../model/daily-package-message';

export function GeneratorDailyPackagePublisher({
  frame,
  loaded,
}: {
  frame: RefObject<HTMLIFrameElement | null>;
  loaded: boolean;
}) {
  const [pending, setPending] = useState<DailyPackageMessage | null>(null);
  const pendingRef = useRef<DailyPackageMessage | null>(null);
  const [branches, setBranches] = useState<
    WorkbenchDailyPackageOptionsV1['data']
  >([]);
  const [branchId, setBranchId] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      const message = dailyPackageEvent(
        event,
        window.location.origin,
        frame.current?.contentWindow,
      );
      if (!message || pendingRef.current) return;
      pendingRef.current = message;
      setPending(message);
      setTitle(message.title);
      setSent(false);
      setError('');
      setBranches([]);
      setBranchId('');
      setLoading(true);
      void workbenchPersonalApi
        .dailyPackageOptions()
        .then((result) => {
          if (pendingRef.current !== message) return;
          setBranches(result.data);
          setBranchId(result.data[0]?.id ?? '');
        })
        .catch((reason) => {
          if (pendingRef.current === message)
            setError(
              reason instanceof Error
                ? reason.message
                : 'دریافت شعبه‌ها انجام نشد.',
            );
        })
        .finally(() => {
          if (pendingRef.current === message) setLoading(false);
        });
    };
    window.addEventListener('message', receive);
    if (loaded)
      frame.current?.contentWindow?.postMessage(
        { type: 'rubi-daily-packages-enabled' },
        window.location.origin,
      );
    return () => {
      window.removeEventListener('message', receive);
      pendingRef.current = null;
    };
  }, [frame, loaded]);

  function finish(success: boolean, message = '') {
    const current = pendingRef.current;
    if (current)
      frame.current?.contentWindow?.postMessage(
        {
          type: 'rubi-daily-package-result',
          requestId: current.requestId,
          success,
          message,
        },
        window.location.origin,
      );
    pendingRef.current = null;
    setPending(null);
  }
  async function publish() {
    if (!pending || !branchId || !title.trim() || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await workbenchPersonalApi.publishDailyPackage({
        branchId,
        title: title.trim(),
        file: new File([pending.blob], 'daily-package.pdf', {
          type: 'application/pdf',
        }),
      });
      finish(true);
      setSent(true);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'ارسال پکیج انجام نشد.',
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <>
      {sent && (
        <Alert title="پکیج به پکیج‌های روز ارسال شد">
          <Link
            className="mt-2 inline-block underline"
            href="/workbench?tab=daily-packages"
          >
            مشاهده پکیج‌های روز
          </Link>
        </Alert>
      )}
      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !savingRef.current) finish(false, 'ارسال پکیج لغو شد.');
        }}
      >
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogTitle>ارسال به پکیج‌های روز</DialogTitle>
          <DialogDescription>
            خروجی نهایی برای کاربران مجاز شعبه انتخاب‌شده قابل مشاهده خواهد بود.
          </DialogDescription>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void publish();
            }}
          >
            <label className="block space-y-2">
              <span>عنوان پکیج</span>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                required
                disabled={saving}
              />
            </label>
            <WorkbenchSelect
              label="شعبه دریافت‌کننده پکیج"
              value={branchId}
              onValueChange={setBranchId}
              options={branches.map((branch) => ({
                value: branch.id,
                label: branch.name,
              }))}
              required
            />
            {error && (
              <Alert
                tone="error"
                title="ارسال پکیج انجام نشد"
                description={error}
              />
            )}
            {!loading && !branches.length && (
              <p className="text-sm text-muted-foreground">
                شعبه مجازی برای ارسال پکیج ندارید.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => finish(false, 'ارسال پکیج لغو شد.')}
              >
                انصراف
              </Button>
              <Button
                type="submit"
                disabled={loading || saving || !branchId || !title.trim()}
              >
                ارسال پکیج
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
