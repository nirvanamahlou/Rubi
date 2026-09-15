'use client';
import { useEffect, useState } from 'react';
import type { TicketOfferManagedPriceV1 } from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form-controls';
import { Alert, Card } from '@/components/ui/surfaces';
import { toursApi } from '../api/tours';

export function LiveTicketPrices() {
  const [offers, setOffers] = useState<TicketOfferManagedPriceV1[]>([]);
  const [drafts, setDrafts] = useState<
    Record<string, { amount: string; currencyCode: string }>
  >({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const reload = () =>
    toursApi
      .managedPrices()
      .then(({ data }) => {
        setOffers(data);
        setDrafts(
          Object.fromEntries(
            data.map((offer) => [
              offer.id,
              {
                amount: offer.standaloneSalePrice?.amount ?? '',
                currencyCode: offer.standaloneSalePrice?.currencyCode ?? 'IRR',
              },
            ]),
          ),
        );
      })
      .catch((reason: unknown) =>
        setMessage(
          reason instanceof Error
            ? reason.message
            : 'دریافت قیمت‌ها ناموفق بود.',
        ),
      );
  useEffect(() => {
    void reload();
  }, []);
  return (
    <Card className="mt-5 space-y-4 p-5" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">قیمت فروش بلیط تکی</h2>
          <p className="text-sm text-muted-foreground">
            قیمت تور از مدیریت قیمت خوانده می‌شود؛ این قیمت فقط برای فروش بلیط
            بدون هتل است.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void reload()}>
          به‌روزرسانی
        </Button>
      </div>
      {message && <Alert title={message} />}
      {offers.length === 0 && (
        <p className="text-sm text-muted-foreground">
          هنوز بلیط واقعی ثبت نشده است.
        </p>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {offers.map((offer) => {
          const draft = drafts[offer.id] ?? { amount: '', currencyCode: 'IRR' };
          return (
            <div key={offer.id} className="grid gap-3 rounded-xl border p-4">
              <div>
                <b>
                  {offer.carrierName} · {offer.serviceNumber}
                </b>
                <p className="text-xs text-muted-foreground">
                  {new Date(offer.departureAt).toLocaleString('fa-IR')} · نسخه
                  قیمت {offer.standaloneSalePrice?.revision ?? 0}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="قیمت هر صندلی">
                  <Input
                    inputMode="decimal"
                    value={draft.amount}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [offer.id]: { ...draft, amount: event.target.value },
                      }))
                    }
                  />
                </FormField>
                <FormField label="ارز">
                  <Input
                    maxLength={3}
                    value={draft.currencyCode}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [offer.id]: {
                          ...draft,
                          currencyCode: event.target.value.toUpperCase(),
                        },
                      }))
                    }
                  />
                </FormField>
              </div>
              <Button
                type="button"
                disabled={!!busy || !draft.amount || !draft.currencyCode}
                onClick={() => {
                  setBusy(offer.id);
                  setMessage('');
                  void toursApi
                    .updateStandaloneSalePrice(
                      offer.id,
                      {
                        expectedRevision:
                          offer.standaloneSalePrice?.revision ?? 0,
                        amount: draft.amount,
                        currencyCode: draft.currencyCode,
                      },
                      crypto.randomUUID(),
                    )
                    .then(() => reload())
                    .then(() => setMessage('قیمت فروش تکی ثبت شد.'))
                    .catch((reason: unknown) =>
                      setMessage(
                        reason instanceof Error
                          ? reason.message
                          : 'ثبت ناموفق بود.',
                      ),
                    )
                    .finally(() => setBusy(null));
                }}
              >
                ثبت قیمت فروش تکی
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
