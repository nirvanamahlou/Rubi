'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { packageTourSelectionBatch } from '@nora/contracts';
import type {
  FloatingTourSaleSet,
  LoginResponse,
  PackageTourCostGridV1,
  PackageTourDraftV1,
  PackageTourPublicationV1,
  TourDepartureV1,
} from '@nora/contracts';
import { packagePricingApi } from '@/modules/pricing-management/api/client';
import { FloatingRegisteredPeriods } from '@/modules/pricing-management/components/floating-registered-periods';
import { WebsiteTourPreviewPrices } from '@/modules/pricing-management/components/website-tour-preview-prices';
import { formatSalesMoney } from '@/components/ui/money-input';

export function InlineFloatingTourPrices({ tourId }: { tourId: string }) {
  const [data, setData] = useState<{
    session: LoginResponse;
    catalog: FloatingTourSaleSet;
  }>();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void packagePricingApi
      .session()
      .then(async (session) => {
        const catalog = await packagePricingApi.floatingPrices(tourId, session);
        if (active) setData({ session, catalog });
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : 'دریافت اطلاعات قیمت‌گذاری ناموفق بود.',
          );
      });
    return () => {
      active = false;
    };
  }, [tourId]);
  if (error)
    return (
      <p role="alert" className="text-destructive">
        {error}
      </p>
    );
  if (!data) return <p role="status">در حال دریافت قیمت‌ها…</p>;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold">قیمت‌های فروش ثبت‌شده</h4>
        <Link
          className="text-sm text-primary underline"
          href={`/sales/pricing/floating?tour=${encodeURIComponent(tourId)}`}
        >
          پکیج‌های شناور
        </Link>
      </div>
      {!data.session.user.permissions.includes(
        'package_pricing.period.manage',
      ) && (
        <p className="text-sm text-muted-foreground">
          مجوز کافی برای مدیریت قیمت پکیج ندارید.
        </p>
      )}
      <FloatingRegisteredPeriods
        catalog={data.catalog}
        tourId={tourId}
        session={data.session}
        canManage={data.session.user.permissions.includes(
          'package_pricing.period.manage',
        )}
        busy={false}
        periodFilter=""
        onChange={(catalog) => setData({ session: data.session, catalog })}
      />
    </>
  );
}

export function InlineDeparturePrices({
  departure,
}: {
  departure: TourDepartureV1;
}) {
  const [data, setData] = useState<{
    session: LoginResponse;
    grid: PackageTourCostGridV1;
    saved: {
      batchId: string;
      draft: PackageTourDraftV1 | null;
      publication?: PackageTourPublicationV1 | undefined;
    }[];
  }>();
  const [error, setError] = useState('');
  const id = departure.id;
  useEffect(() => {
    let active = true;
    void packagePricingApi
      .session()
      .then(async (session) => {
        const grid = await packagePricingApi.tourCosts(id, session);
        if (!active) return;
        const saved = await Promise.all(
          grid.purchaseBatches.map(async ({ id: batchId }) => {
            const [draft, publications] = await Promise.all([
              packagePricingApi.tourDraft(id, batchId, session),
              packagePricingApi.tourPublications(id, batchId, session),
            ]);
            return { batchId, draft, publication: publications[0] };
          }),
        );
        if (active) setData({ session, grid, saved });
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : 'دریافت اطلاعات قیمت‌گذاری ناموفق بود.',
          );
      });
    return () => {
      active = false;
    };
  }, [id]);
  const saved = data?.saved.filter((entry) => entry.draft || entry.publication);
  const amount = (value: string, currency: string) => (
    <bdi>
      {formatSalesMoney(value)} {currency}
    </bdi>
  );
  return (
    <div className="space-y-3">
      <Link
        className="inline-block text-sm text-primary underline"
        href={`/sales/pricing/management?departure=${encodeURIComponent(id)}`}
      >
        مدیریت نوبت و قیمت
      </Link>
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : !data ? (
        <p role="status">در حال دریافت قیمت‌ها…</p>
      ) : !saved?.length ? (
        <p className="text-sm text-muted-foreground">بازه قیمت ثبت نشده است.</p>
      ) : null}
      {saved?.map(({ batchId, draft, publication }) => {
        const batch = data && packageTourSelectionBatch(data.grid, batchId);
        return (
          <div
            key={batchId}
            className="space-y-2 rounded-lg border p-3 text-sm"
          >
            {batch && (
              <p dir="ltr" className="text-end text-muted-foreground">
                {batch.checkIn} — {batch.checkOut}
              </p>
            )}
            {(
              [
                ['پیش‌نویس', draft],
                ['منتشرشده', publication],
              ] as const
            ).map(
              ([label, price]) =>
                price && (
                  <div key={label} className="flex flex-wrap gap-x-4 gap-y-1">
                    <strong>{label}</strong>
                    <span>
                      قیمت فروش پرواز بزرگسال{' '}
                      {amount(
                        price.adultFlightSale,
                        price.adultFlightSaleCurrencyCode ?? price.currencyCode,
                      )}
                    </span>
                    <span>
                      قیمت فروش پرواز کودک{' '}
                      {amount(
                        price.childFlightSale,
                        price.childFlightSaleCurrencyCode ?? price.currencyCode,
                      )}
                    </span>
                  </div>
                ),
            )}
            {publication?.roomPrices.map((room, index) => (
              <div
                key={`${room.hotelRateId}:${room.roomCode}:${index}`}
                className="flex flex-wrap justify-between gap-2 border-t py-2"
              >
                <span>
                  {
                    batch?.rows.find((row) => row.id === room.hotelRateId)
                      ?.hotelName
                  }{' '}
                  · {room.roomTypeName ?? room.roomCode}
                </span>
                <span>
                  {room.currencyAmounts?.length
                    ? room.currencyAmounts.map((money) => (
                        <span key={money.currencyCode} className="ms-2">
                          {amount(money.sale, money.currencyCode)}
                        </span>
                      ))
                    : amount(
                        room.packageSale ?? room.hotelSale,
                        room.currencyCode,
                      )}
                </span>
              </div>
            ))}
            {draft?.roomSaleOverrides?.map((room) => (
              <div
                key={`${room.hotelRateId}:${room.roomCode}:${room.currencyCode}`}
                className="flex flex-wrap justify-between gap-2 border-t py-2"
              >
                <span>
                  پیش‌نویس ·{' '}
                  {
                    batch?.rows.find((row) => row.id === room.hotelRateId)
                      ?.hotelName
                  }{' '}
                  · {room.roomCode}
                </span>
                {amount(room.amount, room.currencyCode)}
              </div>
            ))}
            {publication?.hotelCombinations?.map((quote, index) => (
              <div
                key={index}
                className="flex flex-wrap justify-between gap-2 border-t py-2"
              >
                <span>
                  {quote.stays.map((stay) => stay.hotelName).join(' / ')} ·{' '}
                  {quote.roomCode}
                </span>
                <span>
                  {quote.prices.map((price) => (
                    <span key={price.currencyCode} className="ms-2">
                      {amount(price.amount, price.currencyCode)}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        );
      })}
      {data?.session.user.permissions.includes('ticket_catalog.manage') && (
        <WebsiteTourPreviewPrices
          departureId={id}
          branchId={departure.branchId}
          canEdit={false}
        />
      )}
    </div>
  );
}
