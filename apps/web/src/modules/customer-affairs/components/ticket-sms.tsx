'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormField, Input, Textarea } from '@/components/ui/form-controls';
import { CustomerAffairsFormDialog } from './customer-affairs-form-dialog';
import { customerAffairsApi } from '../api/customer-affairs-client';
export function TicketSms({
  id,
  onReload,
}: {
  id: string;
  onReload: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          if (!key) setKey(crypto.randomUUID());
          setOpen(true);
        }}
      >
        ارسال پیامک
      </Button>
      {open && (
        <CustomerAffairsFormDialog
          title="ارسال پیامک با sms.ir"
          description="ارسال از اعتبار پنل پیامک مصرف می‌کند. شماره گیرنده و متن را پیش از ارسال بررسی کنید؛ یادداشت داخلی خودکار ارسال نمی‌شود."
          busy={busy}
          onClose={() => setOpen(false)}
        >
          <form
            key={key}
            className="grid gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              setBusy(true);
              setError('');
              try {
                const response = await customerAffairsApi.sendSms(
                  id,
                  {
                    mobile: String(data.get('mobile') || '').replace(
                      /[۰-۹]/g,
                      (digit) => String(digit.charCodeAt(0) - 1776),
                    ),
                    message: String(data.get('message') || ''),
                  },
                  key,
                );
                setResult(response.data.status);
                await onReload();
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : 'درخواست ناموفق بود؛ با همان کلید دوباره بررسی کنید.',
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <FormField id="ticket-sms-mobile" label="شماره همراه گیرنده">
              <Input
                id="ticket-sms-mobile"
                name="mobile"
                inputMode="tel"
                required
                maxLength={13}
                disabled={Boolean(result)}
              />
            </FormField>
            <FormField id="ticket-sms-message" label="متن پیامک">
              <Textarea
                id="ticket-sms-message"
                name="message"
                required
                minLength={2}
                maxLength={1000}
                disabled={Boolean(result)}
              />
            </FormField>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {result && (
              <p role="status">
                {result === 'ACCEPTED'
                  ? 'پیام توسط سرویس پذیرفته شد؛ تحویل به گوشی هنوز تأیید نشده است.'
                  : result === 'FAILED'
                    ? 'سرویس پیام را نپذیرفت.'
                    : 'نتیجه ارسال قطعی نیست؛ پیش از ارسال مجدد، گزارش پنل sms.ir را بررسی کنید.'}
              </p>
            )}
            <Button type="submit" disabled={busy || Boolean(result)}>
              ارسال پیامک به گیرنده
            </Button>
            {['ACCEPTED', 'FAILED'].includes(result) && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setResult('');
                  setError('');
                  setKey(crypto.randomUUID());
                }}
              >
                نوشتن پیام جدید
              </Button>
            )}
          </form>
        </CustomerAffairsFormDialog>
      )}
    </>
  );
}
