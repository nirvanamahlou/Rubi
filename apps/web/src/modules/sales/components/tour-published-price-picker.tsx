'use client';
import { useEffect, useState } from 'react';
import type {
  PackageTourSalesPriceChoiceV1,
  SalesServicePricingV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Alert, Card } from '@/components/ui/surfaces';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import type { SalesFormState } from '../model/sales-form';
import { publishedTourServicePricing } from '../model/sales-price-source';

export function TourPublishedPricePicker({
  state,
  onChange,
}: {
  state: SalesFormState;
  onChange: (
    source: PackageTourSalesPriceChoiceV1,
    pricing: Record<string, SalesServicePricingV1[]>,
  ) => void;
}) {
  const [choices, setChoices] = useState<
    readonly PackageTourSalesPriceChoiceV1[]
  >([]);
  const [problem, setProblem] = useState('');
  const tourId = state.tour?.id;
  useEffect(() => {
    if (!tourId) return;
    let live = true;
    void (async () => {
      const base = getPublicApiBaseUrl();
      if (!base) throw new Error('سرور قیمت‌گذاری در دسترس نیست.');
      await refreshAuthenticatedSession(base);
      const response = await fetch(
        `${base}/sales/pricing/tour-drafts/sales-choices?tourDepartureId=${encodeURIComponent(tourId)}`,
        { credentials: 'include', cache: 'no-store' },
      );
      if (!response.ok) throw new Error('قیمت منتشرشده تور دریافت نشد.');
      return response.json() as Promise<PackageTourSalesPriceChoiceV1[]>;
    })()
      .then((data) => {
        if (live) setChoices(data);
      })
      .catch((reason: unknown) => {
        if (live)
          setProblem(
            reason instanceof Error
              ? reason.message
              : 'دریافت قیمت ناموفق بود.',
          );
      });
    return () => {
      live = false;
    };
  }, [tourId]);
  // The API already limits purchase batches to the selected tour's valid stay window.
  const applicable = choices.filter(
    (choice) => !state.hotel.hotelId || choice.hotelId === state.hotel.hotelId,
  );
  const select = (choice: PackageTourSalesPriceChoiceV1) => {
    try {
      onChange(choice, publishedTourServicePricing(state, choice));
      setProblem('');
    } catch (reason) {
      setProblem(
        reason instanceof Error
          ? reason.message
          : 'قیمت منتشرشدهٔ تور معتبر نیست.',
      );
    }
  };
  return (
    <Card className="space-y-3 p-4" dir="rtl">
      <h3 className="font-bold">قیمت منتشرشده تور از مدیریت قیمت</h3>
      {problem && <Alert tone="warning" title={problem} />}
      {!problem && !applicable.length && (
        <p className="text-sm text-muted-foreground">
          برای هتل این قرارداد قیمت منتشرشده‌ای موجود نیست؛ ابتدا قیمت تور را در
          مدیریت قیمت منتشر کنید.
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {applicable.map((choice) => (
          <Button
            key={`${choice.publicationId}-${choice.hotelRateId}-${choice.roomCode}`}
            type="button"
            variant={
              state.tourPriceSource?.publicationId === choice.publicationId &&
              state.tourPriceSource?.hotelRateId === choice.hotelRateId &&
              state.tourPriceSource?.roomCode === choice.roomCode
                ? 'primary'
                : 'outline'
            }
            className="h-auto whitespace-normal py-3"
            onClick={() => select(choice)}
          >
            {choice.hotelName} · {choice.roomCode} · نرخ {choice.checkIn} تا{' '}
            {choice.checkOut} · نسخه {choice.priceVersion} ·{' '}
            {choice.currencyCode}
          </Button>
        ))}
      </div>
    </Card>
  );
}
