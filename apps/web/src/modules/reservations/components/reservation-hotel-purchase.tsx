'use client';
import { EnglishHotelName } from './english-hotel-name';
import { useRef, useState } from 'react';
import {
  hotelNights,
  resolveSalesPrice,
  moneyUnits,
  moneyDecimal,
  type ReservationIntakeV1,
} from '@rubi/contracts';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form-controls';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import {
  MoneyInput as SalesMoneyInput,
  formatSalesMoney,
} from '@/components/ui/money-input';

export function ReservationHotelPurchase({
  request,
  onSaved,
}: {
  request: ReservationIntakeV1;
  onSaved: () => void;
}) {
  const hotel = request.snapshot.hotelSelection;
  const pricing =
    request.snapshot.serviceSelections.find(
      (service) => service.clientKey === hotel?.serviceClientKey,
    )?.pricing ?? [];
  const [amount, setAmount] = useState('');
  const [code, setCode] = useState(pricing[0]?.currencyCode ?? 'IRR');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  if (!hotel) return null;
  let nights = 0;
  try {
    nights = hotelNights(hotel.checkInDate, hotel.checkOutDate);
  } catch {
    /* Legacy snapshot without valid dates. */
  }
  async function save() {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      if (moneyUnits(amount) <= 0n)
        throw new Error('مبلغ خرید باید مثبت باشد.');
      const base = getPublicApiBaseUrl();
      if (!base) throw new Error('نشانی سرور تنظیم نشده است.');
      const payload = JSON.stringify({
        version: 1,
        expectedVersion: request.purchaseVersion ?? 0,
        amount,
        currencyCode: code,
      });
      if (attempt.current?.payload !== payload)
        attempt.current = { payload, key: crypto.randomUUID() };
      const send = () =>
        fetch(
          base +
            '/reservations/requests/' +
            encodeURIComponent(request.id) +
            '/hotel-purchase',
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': attempt.current!.key,
            },
            body: payload,
          },
        );
      let response = await send();
      if (response.status === 401 && (await refreshAuthenticatedSession(base)))
        response = await send();
      if (!response.ok) {
        if (response.status === 403)
          throw new Error('مجوز ثبت هزینه خرید هتل برای این حساب فعال نیست.');
        if (response.status === 409)
          throw new Error(
            'نسخه هزینه خرید تغییر کرده؛ ابتدا فهرست را به‌روزرسانی کنید.',
          );
        throw new Error(
          'ثبت هزینه خرید هتل ناموفق بود؛ مبلغ، ارز و دسترسی را بررسی کنید.',
        );
      }
      setMessage('هزینه خرید با سابقه تغییرات ثبت شد.');
      onSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ثبت ناموفق بود.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-4 space-y-3 rounded-xl border bg-muted/20 p-4">
      <h3 className="font-bold">
        <EnglishHotelName
          hotelId={hotel.hotelId}
          fallback={hotel.hotelNameSnapshot}
        />{' '}
        · {nights.toLocaleString('fa-IR')} شب
      </h3>
      <p className="text-xs text-muted-foreground">
        قیمت‌های فروشِ ثبت‌شده در قرارداد قابل تغییر نیستند؛ هزینه خرید کل اقامت
        را اینجا ثبت کنید.
      </p>
      {pricing.map((price) => {
        let totals;
        try {
          totals = resolveSalesPrice(price, nights, true);
        } catch {
          return (
            <p key={price.currencyCode}>قیمت فروش این نسخه قابل محاسبه نیست.</p>
          );
        }
        const cost = request.hotelPurchases?.find(
          (item) => item.currencyCode === price.currencyCode,
        );
        return (
          <div
            key={price.currencyCode}
            className="grid gap-2 text-sm md:grid-cols-2"
          >
            <p>
              قیمت روز فروش کل: {formatSalesMoney(totals.dayTotal)}{' '}
              {price.currencyCode}
            </p>
            <p>
              توافق مشتری کل: {formatSalesMoney(totals.agreedTotal)}{' '}
              {price.currencyCode}
            </p>
            <p>
              اختلاف روز فروش و توافق: {formatSalesMoney(totals.discount)}{' '}
              {price.currencyCode}
            </p>
            <p>
              {cost
                ? `هزینه خرید ثبت‌شده: ${formatSalesMoney(cost.amount)} ${cost.currencyCode}`
                : 'هزینه خرید: ثبت نشده'}
            </p>
            {cost ? (
              <p className="font-bold">
                حاشیه هتل بر اساس هزینه ثبت‌شده:{' '}
                {formatSalesMoney(
                  moneyDecimal(
                    moneyUnits(totals.agreedTotal) - moneyUnits(cost.amount),
                  ),
                )}{' '}
                {price.currencyCode}
              </p>
            ) : null}
          </div>
        );
      })}
      {!pricing.length ? (
        <p className="text-xs">
          این نسخه قدیمی، تفکیک قیمت روز و توافقی ندارد؛ سود محاسبه نمی‌شود.
        </p>
      ) : null}
      <fieldset disabled={busy} className="flex flex-wrap items-end gap-3">
        <FormField label="هزینه خرید کل هتل">
          <SalesMoneyInput
            aria-label="هزینه خرید کل هتل"
            value={amount}
            onValueChange={setAmount}
          />
        </FormField>
        <FormField label="ارز خرید">
          <Input
            aria-label="ارز خرید هتل"
            className="w-24"
            dir="ltr"
            maxLength={3}
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
        </FormField>
        <Button
          type="button"
          disabled={busy || !amount}
          onClick={() => void save()}
        >
          {busy ? 'در حال ثبت…' : 'ثبت هزینه خرید هتل'}
        </Button>
      </fieldset>
      <p role="status" className="text-sm">
        {message}
      </p>
      <p className="text-xs text-muted-foreground">
        هزینه ثبت‌شده عملیاتی است؛ جایگزین تأیید خرید یا پرداخت مالی نیست. تخفیف
        فروشنده با هزینه خرید مخلوط نمی‌شود.
      </p>
      {request.hotelPurchases?.map((cost) => (
        <p key={cost.id} className="text-xs text-muted-foreground">
          آخرین ثبت {cost.currencyCode}: {formatSalesMoney(cost.amount)} · نسخه{' '}
          {cost.version} · {new Date(cost.createdAt).toLocaleString('fa-IR')}
        </p>
      ))}
    </div>
  );
}
