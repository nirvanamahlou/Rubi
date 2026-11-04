'use client';
import {
  readPassengerHotelStays,
  type SalesContractAmendmentV1,
} from '@nora/contracts';
import { SalesDatePicker } from '@/modules/sales/components/sales-date-picker';

export function PassengerServiceEditor({
  draft,
  customerId,
  disabled,
  onChange,
}: {
  draft: SalesContractAmendmentV1;
  customerId: string;
  disabled: boolean;
  onChange: (draft: SalesContractAmendmentV1) => void;
}) {
  const passenger = draft.passengers.find((p) => p.customerId === customerId);
  if (!passenger) return null;
  const hotel = draft.hotelSelection;
  const stays = readPassengerHotelStays(draft.services, hotel) ?? {};
  const guest =
    hotel && passenger.serviceClientKeys.includes(hotel.serviceClientKey);
  const stay = guest
    ? (stays[customerId] ?? { ...hotel, different: false })
    : null;
  const updateStay = (value: {
    different: boolean;
    checkInDate: string;
    checkOutDate: string;
  }) => {
    if (!hotel) return;
    const complete = Object.fromEntries(
      draft.passengers
        .filter((p) => p.serviceClientKeys.includes(hotel.serviceClientKey))
        .map((p) => [
          p.customerId,
          p.customerId === customerId
            ? value
            : (stays[p.customerId] ?? {
                different: false,
                checkInDate: hotel.checkInDate,
                checkOutDate: hotel.checkOutDate,
              }),
        ]),
    );
    onChange({
      ...draft,
      services: draft.services.map((s) =>
        s.clientKey === hotel.serviceClientKey
          ? {
              ...s,
              metadata: {
                ...s.metadata,
                passengerHotelStaysV1: JSON.stringify(complete),
              },
            }
          : s,
      ),
    });
  };
  return (
    <div className="grid min-w-64 gap-2">
      {draft.services
        .filter((s) => s.kind === 'FLIGHT' || s.kind === 'TRANSFER')
        .map((service) => {
          const direction =
            service.metadata?.direction ??
            draft.ticketSelections?.find(
              (selection) => selection.serviceClientKey === service.clientKey,
            )?.direction;
          const label =
            (service.kind === 'FLIGHT' ? 'بلیط' : 'ترانسفر') +
            ' ' +
            (direction === 'RETURN'
              ? 'برگشت'
              : direction === 'OUTBOUND'
                ? 'رفت'
                : service.titleSnapshot);
          return (
            <label key={service.clientKey} className="flex items-center gap-2">
              <input
                type="checkbox"
                disabled={disabled}
                checked={passenger.serviceClientKeys.includes(
                  service.clientKey,
                )}
                onChange={(event) => {
                  const passengers = draft.passengers.map((p) =>
                    p.customerId === customerId
                      ? {
                          ...p,
                          serviceClientKeys: event.target.checked
                            ? [
                                ...new Set([
                                  ...p.serviceClientKeys,
                                  service.clientKey,
                                ]),
                              ]
                            : p.serviceClientKeys.filter(
                                (key) => key !== service.clientKey,
                              ),
                        }
                      : p,
                  );
                  onChange({
                    ...draft,
                    passengers,
                    services: draft.services.map((s) =>
                      s.clientKey === service.clientKey && s.kind === 'TRANSFER'
                        ? {
                            ...s,
                            metadata: {
                              ...s.metadata,
                              passengerCount: passengers.filter((p) =>
                                p.serviceClientKeys.includes(s.clientKey),
                              ).length,
                            },
                          }
                        : s,
                    ),
                  });
                }}
              />
              {label}
            </label>
          );
        })}
      {stay && (
        <>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              disabled={disabled}
              checked={stay.different}
              onChange={(event) =>
                updateStay({
                  different: event.target.checked,
                  checkInDate: event.target.checked
                    ? stay.checkInDate
                    : hotel!.checkInDate,
                  checkOutDate: event.target.checked
                    ? stay.checkOutDate
                    : hotel!.checkOutDate,
                })
              }
            />
            c.in , cout متفاوت
          </label>
          <SalesDatePicker
            calendarSystem="gregorian"
            aria-label="چک‌این هتل"
            value={stay.checkInDate}
            disabled={disabled || !stay.different}
            onChange={(checkInDate) => updateStay({ ...stay, checkInDate })}
          />
          <SalesDatePicker
            calendarSystem="gregorian"
            aria-label="چک‌اوت هتل"
            value={stay.checkOutDate}
            disabled={disabled || !stay.different}
            onChange={(checkOutDate) => updateStay({ ...stay, checkOutDate })}
          />
        </>
      )}
    </div>
  );
}
