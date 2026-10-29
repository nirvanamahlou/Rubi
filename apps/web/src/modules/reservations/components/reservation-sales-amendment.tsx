'use client';
import { AmendmentPassengerPriceTable } from './amendment-passenger-price-table';
import { AmendmentPassengerMembership } from './amendment-passenger-membership';
import { AmendmentHotelRooms } from './amendment-hotel-rooms';
import { PassengerCompletion } from '@/modules/sales/components/passenger-completion';
import { PassengerServiceEditor } from './passenger-service-editor';
import { prepareAmendmentPersonPrices } from './amendment-passenger-prices';
import { amendmentPriceComponents } from './amendment-price-components';
import { isOptionalOperationReason } from '@nora/contracts';

import {
  ReservationPassengers,
  type ReservationPassengerEditor,
} from '../passenger-files/passengers';
import {
  PassengerAgeEditor,
  changeAmendmentPassengerAge,
} from './passenger-age-editor';
import { currencySymbol } from '@/lib/currency-symbol';
import { useEffect, useRef, useState } from 'react';
import type {
  MasterDataRecord,
  MasterDataResource,
  SalesContractDetail,
  SalesContractAmendmentV1,
  SalesHotelSelectionInput,
  SalesTicketDirection,
} from '@nora/contracts';
import {
  salesChequeComponents,
  readLegacyServiceParties,
  readPassengerHotelStays,
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
  amendmentFlightDay,
  matchesSavedAmendmentFlight,
} from './amendment-flight-search';
import {
  amendmentFromContract,
  amendmentBusinessOutput,
  withAmendmentBusinessOutput,
  manualAmendmentFlights,
  applyManualAmendmentFlights,
  replaceAmendmentFlight,
} from './contract-amendment-model';

export function ReservationSalesAmendment({
  contract,
  requestId,
  section,
  onSaved,
}: {
  contract: SalesContractDetail;
  requestId?: string;
  section: 'FLIGHT' | 'HOTEL' | 'OTHER' | 'CORRECTION' | 'PRICES';
  onSaved: () => void;
}) {
  const passengerEditor = useRef<ReservationPassengerEditor>(null);
  const [draft, setDraft] = useState(() => amendmentFromContract(contract));
  const [manualDirty, setManualDirty] = useState<SalesTicketDirection[]>([]);
  const [manualFlights, setManualFlights] = useState(() =>
    manualAmendmentFlights(contract),
  );
  const [refs, setRefs] = useState<Record<string, MasterDataRecord[]>>({});
  const [error, setError] = useState('');
  const [priceError, setPriceError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [completionPending, setCompletionPending] = useState(false);
  const [direction, setDirection] = useState<SalesTicketDirection>('OUTBOUND');
  const [airline, setAirline] = useState('');
  const [day, setDay] = useState(() => amendmentFlightDay(draft, 'OUTBOUND'));
  useEffect(() => {
    let live = true;
    const resources: MasterDataResource[] = [
      'airlines',
      'countries',
      'cities',
      'hotels',
      'room-types',
      'meal-services',
      'currencies',
    ];
    void Promise.all(
      resources.map(async (resource) => {
        const rows: MasterDataRecord[] = [];
        for (let page = 1; ; page++) {
          const r = await masterDataApi.list(
            resource,
            {
              search: '',
              status: 'active',
              sortBy: 'name',
              sortDirection: 'asc',
              page,
              pageSize: 100,
            },
            'reservations',
          );
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
    setDraft((d) => {
      const next = { ...d, ...v };
      if (
        section !== 'CORRECTION' &&
        next.services.some(
          (s) => s.metadata?.automaticFlightRoomTotalV1 === true,
        )
      ) {
        try {
          const components = amendmentPriceComponents(next);
          if (components)
            next.priceComponents = salesChequeComponents(
              components,
              next.paymentTerms,
            );
        } catch {
          /* Keep incomplete price input editable until submission. */
        }
      }
      return next;
    });
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
  const membershipChanged =
    draft.passengers.map((p) => p.customerId).join('|') !==
    contract.passengersDetail.map((p) => p.customerId).join('|');
  function changeHotel(v: Partial<SalesHotelSelectionInput>) {
    if (hotel) {
      const nextHotel = { ...hotel, ...v };
      const stays = readPassengerHotelStays(draft.services, nextHotel);
      patch({
        hotelSelection: nextHotel,
        services: draft.services.map((s) =>
          s.clientKey === hotel.serviceClientKey
            ? {
                ...s,
                ...(v.hotelId ? { referenceId: v.hotelId } : {}),
                titleSnapshot: v.hotelNameSnapshot ?? s.titleSnapshot,
                ...(stays
                  ? {
                      metadata: {
                        ...s.metadata,
                        passengerHotelStaysV1: JSON.stringify(stays),
                      },
                    }
                  : {}),
              }
            : s,
        ),
      });
    }
  }
  async function submit() {
    if (priceError) {
      setError(priceError);
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (section === 'CORRECTION' && requestId) {
        const unchanged =
          JSON.stringify({ ...draft, reason: '' }) ===
          JSON.stringify(amendmentFromContract(contract));
        if (
          !passengerEditor.current ||
          !(await passengerEditor.current.savePending())
        )
          return;
        if (unchanged) {
          setSaved(true);
          onSaved();
          return;
        }
      }
      const corrected = applyManualAmendmentFlights(
        section === 'PRICES' || section === 'CORRECTION' || membershipChanged
          ? prepareAmendmentPersonPrices(draft)
          : draft,
        Object.fromEntries(
          Object.entries(manualFlights).filter(([key]) =>
            manualDirty.includes(key as SalesTicketDirection),
          ),
        ),
      );
      const derived = amendmentPriceComponents(corrected);
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
  const chosen = draft.ticketSelections?.find((t) => t.direction === direction);
  return (
    <div className="grid gap-4">
      {section !== 'CORRECTION' && (
        <p className="text-sm text-muted-foreground">
          اصلاح روی اصل قرارداد ذخیره می‌شود؛ دریافت‌های قبلی و سابقهٔ مدارک حفظ
          می‌شوند.
        </p>
      )}
      <fieldset
        disabled={
          busy || completionPending || (section !== 'CORRECTION' && saved)
        }
        className="grid gap-4"
      >
        {section === 'CORRECTION' &&
          requestId &&
          (!contract.passengersDetail.length &&
          readLegacyServiceParties(draft.services) ? (
            <PassengerCompletion
              contractId={contract.id}
              onSaved={onSaved}
              onPending={setCompletionPending}
            />
          ) : (
            <AmendmentPassengerMembership
              contractId={contract.id}
              draft={draft}
              disabled={busy || saved}
              currencies={(refs.currencies ?? []).map((c) => ({
                code: c.code ?? '',
                name: c.name,
                status: c.status,
              }))}
              onChange={(next) => {
                setDraft(next);
                setPriceError('');
              }}
              onPending={setCompletionPending}
            />
          ))}
        {section === 'FLIGHT' && (
          <>
            <label className="flex items-center gap-3 rounded-xl bg-primary/5 p-3">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={amendmentBusinessOutput(draft)}
                onChange={(event) =>
                  patch(
                    withAmendmentBusinessOutput(draft, event.target.checked),
                  )
                }
              />
              این بلیط بیزینس است — درج در خروجی
            </label>
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
                      setDay(amendmentFlightDay(draft, d));
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
              enabled={!!day}
              emptyMessage={
                matchesSavedAmendmentFlight(
                  draft,
                  direction,
                  day,
                  refs.airlines?.find((r) => r.id === airline)?.name,
                )
                  ? 'بلیت جایگزینی برای این مسیر و تاریخ پیدا نشد؛ بلیت فعلی قرارداد حفظ شده است.'
                  : undefined
              }
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
        {(section === 'HOTEL' || (section === 'CORRECTION' && hotel)) &&
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
              <AmendmentHotelRooms
                hotel={hotel}
                roomTypes={refs['room-types'] ?? []}
                currencies={(refs.currencies ?? []).map((c) => ({
                  code: c.code ?? '',
                  name: c.name,
                  status: c.status,
                }))}
                onChange={(hotelSelection) => patch({ hotelSelection })}
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
              {!hotel.rooms?.length &&
                (
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
        {section === 'CORRECTION' && requestId && (
          <>
            <ReservationPassengers
              id={requestId}
              customerIds={draft.passengers.map((p) => p.customerId)}
              saveRef={passengerEditor}
              onDirty={() => setSaved(false)}
              serviceEditor={(customerId) => (
                <PassengerServiceEditor
                  draft={draft}
                  customerId={customerId}
                  disabled={busy || saved}
                  onChange={setDraft}
                />
              )}
              ageEditor={(customerId) => {
                const passenger = draft.passengers.find(
                  (p) => p.customerId === customerId,
                );
                if (!passenger) return '—';
                return (
                  <PassengerAgeEditor
                    passenger={passenger}
                    category={draft.passengerCategories[customerId]!}
                    disabled={busy || saved}
                    onCategory={(category) =>
                      setDraft((current) =>
                        changeAmendmentPassengerAge(
                          current,
                          customerId,
                          category,
                        ),
                      )
                    }
                    onBand={(childAgeBand) =>
                      patch({
                        passengers: draft.passengers.map((p) =>
                          p.customerId === customerId
                            ? { ...p, childAgeBand: childAgeBand ?? null }
                            : p,
                        ),
                      })
                    }
                    onAccommodation={(accommodationKind) =>
                      patch({
                        passengers: draft.passengers.map((p) =>
                          p.customerId === customerId
                            ? { ...p, accommodationKind }
                            : p,
                        ),
                      })
                    }
                  />
                );
              }}
            />
          </>
        )}
        {(section === 'PRICES' ||
          (section === 'CORRECTION' &&
            (membershipChanged ||
              contract.passengersDetail.some(
                (p) => !p.agreedPrices?.length,
              )))) && (
          <>
            <AmendmentPassengerPriceTable
              key={draft.passengers.map((p) => p.customerId).join('|')}
              draft={draft}
              currencies={(refs.currencies ?? []).map((c) => ({
                code: c.code ?? '',
                name: c.name,
                status: c.status,
              }))}
              onChange={setDraft}
              onError={setPriceError}
            />
            {priceError && (
              <p role="alert" className="text-destructive">
                {priceError}
              </p>
            )}
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
          disabled={
            busy ||
            completionPending ||
            saved ||
            !!priceError ||
            !isOptionalOperationReason(draft.reason)
          }
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
