'use client';
import { currencySymbol } from '@/lib/currency-symbol';
import { useEffect, useState } from 'react';
import type {
  MasterDataRecord,
  MasterDataResource,
  SalesContractDetail,
  SalesContractAmendmentV1,
  SalesHotelSelectionInput,
  SalesPassengerAgeCategory,
  SalesTicketDirection,
} from '@nora/contracts';
import {
  moneyUnits,
  moneyDecimal,
  SALES_CHEQUE_FEE,
  servicePriceComponents,
  salesChequeComponents,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/form-controls';
import { masterDataApi } from '@/modules/master-data/api/client';
import { salesApi } from '@/modules/sales/api/client';
import { SearchableReference } from '@/modules/sales/components/searchable-reference';
import { ContractFlightEditor } from '@/modules/sales/components/contract-flight-editor';
import { exactFlightQuery } from '@/modules/sales/model/exact-flight-dates';
import { TicketOfferPicker } from '@/modules/sales/components/ticket-offer-picker';
import { SalesDatePicker } from '@/modules/sales/components/sales-date-picker';
import {
  amendmentFromContract,
  manualAmendmentFlights,
  applyManualAmendmentFlights,
  replaceAmendmentFlight,
} from './contract-amendment-model';

export function ReservationSalesAmendment({
  contract,
  section,
  onSaved,
}: {
  contract: SalesContractDetail;
  section: 'FLIGHT' | 'HOTEL' | 'OTHER' | 'CORRECTION' | 'PRICES';
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState(() => amendmentFromContract(contract));
  const [manualDirty, setManualDirty] = useState<SalesTicketDirection[]>([]);
  const [manualFlights, setManualFlights] = useState(() =>
    manualAmendmentFlights(contract),
  );
  const [refs, setRefs] = useState<Record<string, MasterDataRecord[]>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [direction, setDirection] = useState<SalesTicketDirection>('OUTBOUND');
  const [airline, setAirline] = useState('');
  const [day, setDay] = useState(contract.departureDate.slice(0, 10));
  useEffect(() => {
    let live = true;
    const resources: MasterDataResource[] = [
      'airlines',
      'countries',
      'cities',
      'hotels',
      'room-types',
      'meal-services',
    ];
    void Promise.all(
      resources.map(async (resource) => {
        const rows: MasterDataRecord[] = [];
        for (let page = 1; ; page++) {
          const r = await masterDataApi.list(resource, {
            search: '',
            status: 'active',
            sortBy: 'name',
            sortDirection: 'asc',
            page,
            pageSize: 100,
          });
          rows.push(...r.data);
          if (!r.data.length || rows.length >= r.meta.total) break;
        }
        return [resource, rows] as const;
      }),
    )
      .then((entries) => {
        if (live) setRefs(Object.fromEntries(entries));
      })
      .catch((e) => {
        if (live)
          setError(
            e instanceof Error ? e.message : 'دریافت اطلاعات پایه ناموفق بود.',
          );
      });
    return () => {
      live = false;
    };
  }, []);
  const patch = (v: Partial<SalesContractAmendmentV1>) =>
    setDraft((d) => ({ ...d, ...v }));
  const international = [draft.originId, draft.destinationId].some((id) => {
    const city = refs.cities?.find((c) => c.id === id);
    const country = refs.countries?.find(
      (c) => c.id === city?.attributes.countryId,
    );
    const code = String(
      country?.attributes.iso2Code ?? country?.code ?? '',
    ).toUpperCase();
    return !!code && !['IR', 'IRN', 'IRAN'].includes(code);
  });
  const hotel = draft.hotelSelection;
  function changeHotel(v: Partial<SalesHotelSelectionInput>) {
    if (hotel)
      patch({
        hotelSelection: { ...hotel, ...v },
        ...(v.hotelId
          ? {
              services: draft.services.map((s) =>
                s.clientKey === hotel.serviceClientKey
                  ? {
                      ...s,
                      referenceId: v.hotelId!,
                      titleSnapshot: v.hotelNameSnapshot ?? s.titleSnapshot,
                    }
                  : s,
              ),
            }
          : {}),
      });
  }
  function changeAge(id: string, category: SalesPassengerAgeCategory) {
    patch({
      passengerCategories: { ...draft.passengerCategories, [id]: category },
      passengers: draft.passengers.map((p) =>
        p.customerId === id
          ? {
              ...p,
              ...(p.accommodationKind
                ? {
                    accommodationKind:
                      category === 'INF'
                        ? 'INFANT'
                        : category === 'CHD'
                          ? 'CHILD_WITH_BED'
                          : 'DBL',
                  }
                : {}),
            }
          : p,
      ),
    });
  }
  async function submit() {
    setBusy(true);
    setError('');
    try {
      const corrected = applyManualAmendmentFlights(
        draft,
        Object.fromEntries(
          Object.entries(manualFlights).filter(([key]) =>
            manualDirty.includes(key as SalesTicketDirection),
          ),
        ),
      );
      const derived = servicePriceComponents(
        corrected.services,
        corrected.hotelSelection,
      );
      await salesApi.amend(
        contract.id,
        derived
          ? {
              ...corrected,
              priceComponents: salesChequeComponents(
                derived,
                draft.paymentTerms,
              ),
            }
          : corrected,
      );
      setSaved(true);
      window.dispatchEvent(new Event('reservation-workflow-changed'));
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ثبت انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  function passengerPrice(index: number, currencyCode: string, amount: string) {
    const passengers = draft.passengers.map((p, i) =>
      i === index
        ? {
            ...p,
            agreedPrices: (p.agreedPrices ?? []).map((v) =>
              v.currencyCode === currencyCode ? { ...v, amount } : v,
            ),
          }
        : p,
    );
    try {
      const totals = new Map<string, bigint>();
      for (const p of passengers)
        for (const v of p.agreedPrices ?? [])
          totals.set(
            v.currencyCode,
            (totals.get(v.currencyCode) ?? 0n) + moneyUnits(v.amount),
          );
      patch({
        passengers,
        priceComponents: [
          ...Array.from(totals, ([currencyCode, amount]) => ({
            type: 'BASE' as const,
            title: 'مبلغ توافق‌شده',
            currencyCode,
            amount: moneyDecimal(amount),
          })),
          ...draft.priceComponents.filter((p) => p.title === SALES_CHEQUE_FEE),
        ],
      });
    } catch {
      patch({ passengers });
    }
  }
  const chosen = draft.ticketSelections?.find((t) => t.direction === direction);
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        اصلاح روی اصل قرارداد ذخیره می‌شود؛ دریافت‌های قبلی و سابقهٔ مدارک حفظ
        می‌شوند.
      </p>
      <fieldset disabled={busy || saved} className="grid gap-4">
        {section === 'FLIGHT' && (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <SearchableReference
                label="مبدأ"
                value={draft.originId}
                options={refs.cities ?? []}
                onChange={(originId) => patch({ originId })}
              />
              <SearchableReference
                label="مقصد"
                value={draft.destinationId}
                options={refs.cities ?? []}
                onChange={(destinationId) => patch({ destinationId })}
              />
              <label>
                تاریخ پرواز
                <SalesDatePicker
                  value={day}
                  defaultCalendarSystem={
                    international ? 'gregorian' : 'persian'
                  }
                  onChange={setDay}
                />
              </label>
            </div>
            <div className="flex gap-2">
              {(['OUTBOUND', 'RETURN'] as const)
                .filter(
                  (d) => d === 'OUTBOUND' || draft.tripType === 'ROUND_TRIP',
                )
                .map((d) => (
                  <Button
                    key={d}
                    variant={direction === d ? 'primary' : 'outline'}
                    onClick={() => {
                      setDirection(d);
                      setDay(
                        draft.ticketSelections
                          ?.find((t) => t.direction === d)
                          ?.departureAt.slice(0, 10) ?? day,
                      );
                    }}
                  >
                    {d === 'OUTBOUND' ? 'رفت' : 'برگشت'}
                  </Button>
                ))}
            </div>
            {chosen && (
              <p>
                {chosen.carrierNameSnapshot} · {chosen.serviceNumberSnapshot} ·{' '}
                {chosen.departureAt}
              </p>
            )}
            {manualFlights[direction] && (
              <ContractFlightEditor
                value={manualFlights[direction]}
                airlines={refs.airlines ?? []}
                international={international}
                onChange={(value) => {
                  setManualDirty((current) => [
                    ...new Set([...current, direction]),
                  ]);
                  setManualFlights((current) => {
                    const next = { ...current };
                    if (value) next[direction] = value;
                    else delete next[direction];
                    return next;
                  });
                }}
              />
            )}
            <SearchableReference
              label="ایرلاین"
              value={airline}
              options={refs.airlines ?? []}
              onChange={setAirline}
            />
            <TicketOfferPicker
              carrierName={refs.airlines?.find((r) => r.id === airline)?.name}
              exactDay={day}
              query={{
                originId:
                  direction === 'OUTBOUND'
                    ? draft.originId
                    : draft.destinationId,
                destinationId:
                  direction === 'OUTBOUND'
                    ? draft.destinationId
                    : draft.originId,
                ...exactFlightQuery(day),
              }}
              selectedId={chosen?.offerId ?? ''}
              requiredSeats={
                draft.passengers.filter(
                  (p) => draft.passengerCategories[p.customerId] !== 'INF',
                ).length
              }
              onSelect={(offer) => {
                setDraft((d) => replaceAmendmentFlight(d, direction, offer));
                setManualFlights((current) => {
                  const next = { ...current };
                  delete next[direction];
                  return next;
                });
              }}
            />
          </>
        )}
        {section === 'HOTEL' &&
          (hotel ? (
            <div className="grid gap-3 md:grid-cols-3">
              <SearchableReference
                label="هتل"
                value={hotel.hotelId}
                options={refs.hotels ?? []}
                onChange={(hotelId) => {
                  const h = refs.hotels?.find((h) => h.id === hotelId);
                  if (h)
                    changeHotel({
                      hotelId,
                      hotelNameSnapshot: h.name,
                      cityId:
                        typeof h.attributes.cityId === 'string'
                          ? h.attributes.cityId
                          : hotel.cityId,
                    });
                }}
              />
              <SearchableReference
                label="نوع اتاق"
                value={hotel.roomTypeId}
                options={refs['room-types'] ?? []}
                onChange={(roomTypeId) => changeHotel({ roomTypeId })}
              />
              <SearchableReference
                label="سرویس هتل"
                value={hotel.mealServiceId ?? ''}
                options={refs['meal-services'] ?? []}
                onChange={(mealServiceId) => changeHotel({ mealServiceId })}
              />
              <label>
                ورود
                <SalesDatePicker
                  defaultCalendarSystem={
                    international ? 'gregorian' : 'persian'
                  }
                  value={hotel.checkInDate.slice(0, 10)}
                  onChange={(checkInDate) => changeHotel({ checkInDate })}
                />
              </label>
              <label>
                خروج
                <SalesDatePicker
                  defaultCalendarSystem={
                    international ? 'gregorian' : 'persian'
                  }
                  value={hotel.checkOutDate.slice(0, 10)}
                  onChange={(checkOutDate) => changeHotel({ checkOutDate })}
                />
              </label>
              {(
                [
                  'roomCount',
                  'singleRoomCount',
                  'doubleRoomCount',
                  'extraBedCount',
                  'occupancy',
                ] as const
              ).map((key, i) => (
                <label key={key}>
                  {['تعداد اتاق', 'SGL', 'DBL', 'EXT', 'ظرفیت اتاق'][i]}
                  <Input
                    type="number"
                    min={key === 'roomCount' || key === 'occupancy' ? 1 : 0}
                    value={hotel[key] ?? 0}
                    onChange={(e) =>
                      changeHotel({ [key]: Number(e.target.value) })
                    }
                  />
                </label>
              ))}
            </div>
          ) : (
            <p>این قرارداد هتل ندارد.</p>
          ))}
        {section === 'OTHER' && (
          <>
            {draft.services
              .filter((s) => !['FLIGHT', 'HOTEL'].includes(s.kind))
              .map((s) => (
                <label key={s.clientKey}>
                  {s.kind}
                  <Input
                    value={s.titleSnapshot}
                    onChange={(e) =>
                      patch({
                        services: draft.services.map((v) =>
                          v.clientKey === s.clientKey
                            ? { ...v, titleSnapshot: e.target.value }
                            : v,
                        ),
                      })
                    }
                  />
                </label>
              ))}
            <label>
              یادداشت کارشناس
              <Textarea
                value={draft.pricingNotes ?? ''}
                onChange={(e) => patch({ pricingNotes: e.target.value })}
              />
            </label>
          </>
        )}
        {section === 'CORRECTION' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>مسافر</th>
                  <th>رده سنی</th>
                  <th>نوع اقامت</th>
                </tr>
              </thead>
              <tbody>
                {draft.passengers.map((p) => (
                  <tr key={p.customerId}>
                    <td className="p-2">{p.displayNameSnapshot}</td>
                    <td className="p-2">
                      <select
                        className="rounded-lg border bg-background p-2"
                        value={draft.passengerCategories[p.customerId]}
                        onChange={(e) =>
                          changeAge(
                            p.customerId,
                            e.target.value as SalesPassengerAgeCategory,
                          )
                        }
                      >
                        <option value="ADT">بزرگسال</option>
                        <option value="CHD">کودک</option>
                        <option value="INF">نوزاد</option>
                      </select>
                    </td>
                    <td>
                      {p.accommodationKind && (
                        <select
                          className="rounded-lg border bg-background p-2"
                          value={p.accommodationKind}
                          onChange={(e) =>
                            patch({
                              passengers: draft.passengers.map((v) =>
                                v.customerId === p.customerId
                                  ? {
                                      ...v,
                                      accommodationKind: e.target
                                        .value as typeof p.accommodationKind,
                                    }
                                  : v,
                              ),
                            })
                          }
                        >
                          {(draft.passengerCategories[p.customerId] === 'INF'
                            ? ['INFANT']
                            : draft.passengerCategories[p.customerId] === 'CHD'
                              ? ['CHILD_WITH_BED', 'CHILD_WITHOUT_BED']
                              : ['DBL', 'SINGLE']
                          ).map((a) => (
                            <option key={a}>{a}</option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {section === 'PRICES' && (
          <>
            {draft.services.some(
              (s) =>
                s.pricing?.length &&
                s.metadata?.passengerPackagePricingVersion !== 1 &&
                s.metadata?.contractPackagePricingVersion !== 1,
            )
              ? draft.services.map((s) => (
                  <div
                    key={s.clientKey}
                    className="grid gap-2 rounded-xl border p-3"
                  >
                    <strong>{s.titleSnapshot}</strong>
                    {s.pricing?.map((v, i) => (
                      <label key={v.currencyCode}>
                        {currencySymbol(v.currencyCode ?? '')} ·{' '}
                        {v.agreed.basis === 'NIGHT' ? 'هر شب' : 'مبلغ کل'}
                        <Input
                          dir="ltr"
                          inputMode="decimal"
                          value={v.agreed.amount}
                          onChange={(e) =>
                            patch({
                              services: draft.services.map((t) =>
                                t.clientKey === s.clientKey
                                  ? {
                                      ...t,
                                      pricing: (t.pricing ?? []).map((p, j) =>
                                        i === j
                                          ? {
                                              ...p,
                                              agreed: {
                                                ...p.agreed,
                                                amount: e.target.value,
                                              },
                                              daySale: {
                                                ...p.agreed,
                                                amount: e.target.value,
                                              },
                                            }
                                          : p,
                                      ),
                                    }
                                  : t,
                              ),
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                ))
              : draft.passengers.some((p) => p.agreedPrices?.length)
                ? draft.passengers.map((p, i) => (
                    <div
                      key={p.customerId}
                      className="grid gap-2 rounded-xl border p-3 md:grid-cols-3"
                    >
                      <strong>{p.displayNameSnapshot}</strong>
                      {p.agreedPrices?.map((v) => (
                        <label key={v.currencyCode}>
                          {currencySymbol(v.currencyCode ?? '')}
                          <Input
                            dir="ltr"
                            inputMode="decimal"
                            value={v.amount}
                            onChange={(e) =>
                              passengerPrice(i, v.currencyCode, e.target.value)
                            }
                          />
                        </label>
                      ))}
                    </div>
                  ))
                : draft.priceComponents.map((p, i) => (
                    <label key={i}>
                      {p.title} · {currencySymbol(p.currencyCode ?? '')}
                      <Input
                        dir="ltr"
                        inputMode="decimal"
                        value={p.amount}
                        onChange={(e) =>
                          patch({
                            priceComponents: draft.priceComponents.map(
                              (v, j) =>
                                j === i ? { ...v, amount: e.target.value } : v,
                            ),
                          })
                        }
                      />
                    </label>
                  ))}
            <div className="flex flex-wrap gap-4">
              {draft.priceComponents.map((p, i) => (
                <span key={i}>
                  {p.title}:{' '}
                  <b dir="ltr">
                    {p.amount} {currencySymbol(p.currencyCode ?? '')}
                  </b>
                </span>
              ))}
            </div>
          </>
        )}
        <label>
          دلیل اصلاح قرارداد
          <Textarea
            value={draft.reason ?? ''}
            maxLength={500}
            onChange={(e) => patch({ reason: e.target.value })}
          />
        </label>
        <Button
          disabled={busy || saved || !draft.reason?.trim()}
          onClick={() => void submit()}
        >
          {busy ? 'در حال ثبت…' : 'ثبت اصلاح قرارداد'}
        </Button>
      </fieldset>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {saved && <p role="status">اصلاح قرارداد ثبت شد.</p>}
    </div>
  );
}
