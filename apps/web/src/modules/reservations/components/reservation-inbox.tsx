'use client';
import { useEffect, useState } from 'react';
import type {
  ReservationArrangementUpdateV1,
  ReservationIntakeV1,
} from '@rubi/contracts';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form-controls';
import { Alert, Badge, Card, PageHeader } from '@/components/ui/surfaces';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { ReservationHotelPurchase } from './reservation-hotel-purchase';

type ArrangementDraft = ReservationArrangementUpdateV1 & { requestId: string };
const countOptions = Array.from({ length: 31 }, (_, value) => value);

function CountSelect({
  label,
  value,
  min = 0,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  min?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface p-2 text-sm">
      <span className="font-bold">{label}</span>
      <select
        disabled={disabled}
        className="h-9 min-w-24 rounded-lg border border-input bg-surface px-2"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {countOptions.slice(min).map((count) => (
          <option key={count} value={count}>
            {count.toLocaleString('fa-IR')} عدد
          </option>
        ))}
      </select>
    </label>
  );
}

export function initialDraft(request: ReservationIntakeV1): ArrangementDraft {
  const hotel = request.snapshot.hotelSelection;
  const current = request.arrangement;
  const hotelKey = hotel?.serviceClientKey;
  const assigned = (request.snapshot.passengerAssignments ?? [])
    .filter((passenger) =>
      hotelKey ? passenger.serviceClientKeys.includes(hotelKey) : false,
    )
    .map(({ customerId }) => customerId);
  return {
    requestId: request.id,
    expectedVersion: current?.version ?? 0,
    roomCount: current?.roomCount ?? hotel?.roomCount ?? 1,
    singleRoomCount: current?.singleRoomCount ?? hotel?.singleRoomCount ?? 0,
    doubleRoomCount:
      current?.doubleRoomCount ??
      hotel?.doubleRoomCount ??
      hotel?.roomCount ??
      1,
    extraBedCount: current?.extraBedCount ?? hotel?.extraBedCount ?? 0,
    hotelGuestCustomerIds:
      current?.hotelGuestCustomerIds ??
      (assigned.length ? assigned : request.snapshot.passengerIds),
    reason: '',
  };
}

export function ReservationInbox() {
  const [requests, setRequests] = useState<ReservationIntakeV1[]>([]);
  const [draft, setDraft] = useState<ArrangementDraft | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setBusy(true);
      setError('');
      void (async () => {
        const base = getPublicApiBaseUrl();
        if (!base) throw new Error('نشانی سرور پیکربندی نشده است.');
        const get = () =>
          fetch(`${base}/reservations/requests`, {
            credentials: 'include',
            cache: 'no-store',
          });
        let response = await get();
        if (
          response.status === 401 &&
          (await refreshAuthenticatedSession(base))
        )
          response = await get();
        if (!response.ok)
          throw new Error(
            'دریافت صف رزرواسیون ناموفق بود؛ دسترسی خود را بررسی کنید.',
          );
        const result = (await response.json()) as {
          data: ReservationIntakeV1[];
        };
        if (active) setRequests(result.data);
      })()
        .catch((reason: unknown) => {
          if (active)
            setError(
              reason instanceof Error ? reason.message : 'دریافت ناموفق بود.',
            );
        })
        .finally(() => {
          if (active) setBusy(false);
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [refresh]);

  const save = async (request: ReservationIntakeV1) => {
    if (!draft || draft.requestId !== request.id) return;
    setBusy(true);
    setError('');
    try {
      const base = getPublicApiBaseUrl();
      if (!base) throw new Error('نشانی سرور پیکربندی نشده است.');
      const payload = { ...draft };
      delete (payload as Partial<ArrangementDraft>).requestId;
      const send = () =>
        fetch(`${base}/reservations/requests/${request.id}/arrangement`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      let response = await send();
      if (response.status === 401 && (await refreshAuthenticatedSession(base)))
        response = await send();
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? 'ثبت تغییرات رزرواسیون ناموفق بود.');
      }
      setDraft(null);
      setRefresh((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'ثبت ناموفق بود.');
      setBusy(false);
    }
  };

  const arrangementIsValid =
    draft !== null &&
    draft.roomCount > 0 &&
    draft.singleRoomCount + draft.doubleRoomCount <= draft.roomCount &&
    draft.hotelGuestCustomerIds.length > 0 &&
    draft.reason.trim().length > 0;

  return (
    <div className="grid gap-4">
      <PageHeader
        title="درخواست‌های رزرواسیون"
        description="بررسی ظرفیت، اعضای سفر و چیدمان اجرایی هتل"
        actions={
          <Button disabled={busy} onClick={() => setRefresh(refresh + 1)}>
            به‌روزرسانی
          </Button>
        }
      />
      {error ? <Alert tone="error" title={error} /> : null}
      {busy && !requests.length ? (
        <p>در حال دریافت…</p>
      ) : !requests.length ? (
        <p>درخواستی دریافت نشده است.</p>
      ) : (
        requests.map((request) => {
          const passengers = request.snapshot.passengerAssignments ?? [];
          const counts = {
            adults: passengers.filter(
              ({ ageCategory }) => ageCategory === 'ADT',
            ).length,
            children: passengers.filter(
              ({ ageCategory }) => ageCategory === 'CHD',
            ).length,
            infants: passengers.filter(
              ({ ageCategory }) => ageCategory === 'INF',
            ).length,
          };
          const editing = draft?.requestId === request.id;
          const arrangement = request.arrangement;
          const hotel = request.snapshot.hotelSelection;
          return (
            <Card key={request.id} className="grid gap-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-black">
                    قرارداد {request.snapshot.contractNumber}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    نسخه {request.contractVersion.toLocaleString('fa-IR')} · در
                    انتظار بررسی و اجرا
                  </p>
                </div>
                <Badge>
                  {request.snapshot.serviceSelections
                    .map((service) => service.titleSnapshot)
                    .join('، ')}
                </Badge>
              </div>
              <section className="grid gap-2 rounded-xl border border-border bg-muted/20 p-3">
                <h3 className="font-bold">ترکیب مسافران بلیت</h3>
                <div className="grid gap-2 sm:grid-cols-3">
                  <CountSelect
                    label="بزرگسال"
                    value={counts.adults}
                    disabled
                    onChange={() => {}}
                  />
                  <CountSelect
                    label="کودک (۲ تا ۱۲)"
                    value={counts.children}
                    disabled
                    onChange={() => {}}
                  />
                  <CountSelect
                    label="نوزاد"
                    value={counts.infants}
                    disabled
                    onChange={() => {}}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  این تعداد از قرارداد فروش می‌آید؛ نوزاد صندلی بلیت مصرف
                  نمی‌کند. افزایش یا تعویض مسافر باید با اصلاح قرارداد فروش و
                  کنترل دوباره ظرفیت انجام شود.
                </p>
              </section>
              {hotel ? (
                <section className="grid gap-3 rounded-xl border border-primary/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-bold">{hotel.hotelNameSnapshot}</h3>
                      <p className="text-xs text-muted-foreground">
                        {hotel.checkInDate} تا {hotel.checkOutDate}
                      </p>
                    </div>
                    {!editing ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setDraft(initialDraft(request))}
                      >
                        ویرایش چیدمان هتل
                      </Button>
                    ) : null}
                  </div>
                  {editing && draft ? (
                    <div className="grid gap-3">
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <CountSelect
                          label="تعداد اتاق"
                          min={1}
                          value={draft.roomCount}
                          onChange={(roomCount) => {
                            const singleRoomCount = Math.min(
                              draft.singleRoomCount,
                              roomCount,
                            );
                            setDraft({
                              ...draft,
                              roomCount,
                              singleRoomCount,
                              doubleRoomCount: Math.min(
                                draft.doubleRoomCount,
                                roomCount - singleRoomCount,
                              ),
                            });
                          }}
                        />
                        <CountSelect
                          label="یک‌تخته"
                          value={draft.singleRoomCount}
                          onChange={(singleRoomCount) => {
                            const nextSingle = Math.min(
                              singleRoomCount,
                              draft.roomCount,
                            );
                            setDraft({
                              ...draft,
                              singleRoomCount: nextSingle,
                              doubleRoomCount: Math.min(
                                draft.doubleRoomCount,
                                draft.roomCount - nextSingle,
                              ),
                            });
                          }}
                        />
                        <CountSelect
                          label="دوتخته"
                          value={draft.doubleRoomCount}
                          onChange={(doubleRoomCount) =>
                            setDraft({
                              ...draft,
                              doubleRoomCount: Math.min(
                                doubleRoomCount,
                                draft.roomCount - draft.singleRoomCount,
                              ),
                            })
                          }
                        />
                        <CountSelect
                          label="تخت اضافه"
                          value={draft.extraBedCount}
                          onChange={(extraBedCount) =>
                            setDraft({ ...draft, extraBedCount })
                          }
                        />
                      </div>
                      <fieldset className="grid gap-2">
                        <legend className="font-bold">اعضای اقامت هتل</legend>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {passengers.map((passenger, index) => (
                            <label
                              key={passenger.customerId}
                              className="flex items-center gap-2 rounded-lg border border-border p-2"
                            >
                              <input
                                type="checkbox"
                                checked={draft.hotelGuestCustomerIds.includes(
                                  passenger.customerId,
                                )}
                                onChange={() =>
                                  setDraft({
                                    ...draft,
                                    hotelGuestCustomerIds:
                                      draft.hotelGuestCustomerIds.includes(
                                        passenger.customerId,
                                      )
                                        ? draft.hotelGuestCustomerIds.filter(
                                            (id) => id !== passenger.customerId,
                                          )
                                        : [
                                            ...draft.hotelGuestCustomerIds,
                                            passenger.customerId,
                                          ],
                                  })
                                }
                              />
                              <span>
                                {passenger.displayNameSnapshot ??
                                  `مسافر ${index + 1}`}
                              </span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <Textarea
                        aria-label="دلیل تغییر چیدمان"
                        placeholder="دلیل تغییر چیدمان را بنویسید…"
                        value={draft.reason}
                        onChange={(event) =>
                          setDraft({ ...draft, reason: event.target.value })
                        }
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          disabled={busy || !arrangementIsValid}
                          onClick={() => void save(request)}
                        >
                          ثبت نسخه جدید
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={busy}
                          onClick={() => setDraft(null)}
                        >
                          انصراف
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-4 text-sm">
                      <span>
                        اتاق:{' '}
                        {(
                          arrangement?.roomCount ?? hotel.roomCount
                        ).toLocaleString('fa-IR')}
                      </span>
                      <span>
                        یک‌تخته:{' '}
                        {(
                          arrangement?.singleRoomCount ??
                          hotel.singleRoomCount ??
                          0
                        ).toLocaleString('fa-IR')}
                      </span>
                      <span>
                        دوتخته:{' '}
                        {(
                          arrangement?.doubleRoomCount ??
                          hotel.doubleRoomCount ??
                          hotel.roomCount
                        ).toLocaleString('fa-IR')}
                      </span>
                      <span>
                        تخت اضافه:{' '}
                        {(
                          arrangement?.extraBedCount ??
                          hotel.extraBedCount ??
                          0
                        ).toLocaleString('fa-IR')}
                      </span>
                    </div>
                  )}
                  {arrangement ? (
                    <p className="text-xs text-muted-foreground">
                      نسخه چیدمان {arrangement.version.toLocaleString('fa-IR')}{' '}
                      · {arrangement.reason}
                    </p>
                  ) : null}
                </section>
              ) : null}
              <p className="text-xs text-muted-foreground">
                دریافت: {new Date(request.receivedAt).toLocaleString('fa-IR')}
              </p>
              <ReservationHotelPurchase
                key={request.purchaseVersion ?? 0}
                request={request}
                onSaved={() => setRefresh((value) => value + 1)}
              />
            </Card>
          );
        })
      )}
    </div>
  );
}
