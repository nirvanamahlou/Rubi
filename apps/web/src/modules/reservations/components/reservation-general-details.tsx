'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  hotelNights,
  moneyDecimal,
  moneyUnits,
  resolveSalesPrice,
  salesContractFlights,
  type CustomerDetail,
} from '@rubi/contracts';
import { customersApi } from '@/modules/customers/api/client';
import { formatSalesMoney } from '@/components/ui/money-input';
import { masterDataApi } from '@/modules/master-data/api/client';
import { travelRequest } from './travel-workflow-form';
import { useReservationFormReferences } from './reservation-form-sheet';
import {
  reservationFormData,
  type ReservationFormIntake,
  type ReservationFormReferences,
} from '../model/reservation-form';
import type { RequestView } from '../foundation/model';
import { statusLabels } from '../foundation/model';
import styles from './reservation-general-details.module.css';

const unavailable = 'در اطلاعات قرارداد ثبت نشده';
const text = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : unavailable;
const dateTime = (value?: string) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString('fa-IR')
    : unavailable;
const date = (value?: string) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleDateString('fa-IR')
    : unavailable;

type Group = { title: string; fields: readonly [string, ReactNode][] };

function priceSummary(intake: ReservationFormIntake) {
  const totals = new Map<string, { day: bigint; agreed: bigint }>();
  let nights = 1;
  try {
    if (intake.snapshot.hotelSelection)
      nights = hotelNights(
        intake.snapshot.hotelSelection.checkInDate,
        intake.snapshot.hotelSelection.checkOutDate,
      );
  } catch {
    nights = 1;
  }
  for (const service of intake.snapshot.serviceSelections)
    for (const price of service.pricing ?? []) {
      try {
        const resolved = resolveSalesPrice(
          price,
          service.kind === 'HOTEL' ? nights : 1,
          service.kind === 'HOTEL',
        );
        const current = totals.get(price.currencyCode) ?? {
          day: 0n,
          agreed: 0n,
        };
        current.day += moneyUnits(resolved.dayTotal);
        current.agreed += moneyUnits(resolved.agreedTotal);
        totals.set(price.currencyCode, current);
      } catch {
        // Invalid legacy pricing is omitted instead of being guessed.
      }
    }
  const render = (kind: 'day' | 'agreed' | 'discount') =>
    [...totals]
      .map(([currency, amount]) => {
        const value =
          kind === 'discount' ? amount.day - amount.agreed : amount[kind];
        return `${formatSalesMoney(moneyDecimal(value))} ${currency}`;
      })
      .join(' · ') || unavailable;
  return {
    currencies: [...totals.keys()].join('، ') || unavailable,
    day: render('day'),
    agreed: render('agreed'),
    discount: render('discount'),
  };
}

export function reservationGeneralDetailGroups(
  intake: ReservationFormIntake,
  request: RequestView,
  references: ReservationFormReferences = {},
  customer?: CustomerDetail,
  countryName?: string,
): Group[] {
  const snapshot = intake.snapshot;
  const workflow = intake.workflow;
  const form = reservationFormData(intake, references);
  const hotel = snapshot.hotelSelection;
  const flights = salesContractFlights(
    snapshot.serviceSelections,
    snapshot.ticketSelections ?? [],
  );
  const outbound = flights.find((item) => item.direction === 'OUTBOUND');
  const returning = flights.find((item) => item.direction === 'RETURN');
  const metadata = snapshot.serviceSelections.map(
    (service) => service.metadata,
  );
  const meta = (key: string) =>
    metadata.find((item) => typeof item?.[key] === 'string')?.[key];
  const phone = customer?.contacts.find(
    (contact) => contact.type === 'phone' && contact.isPrimary,
  )?.maskedValue;
  const prices = priceSummary(intake);
  const roomSummary = [
    `کل ${form.rooms}`,
    `DBL ${form.double}`,
    `SGL ${form.single}`,
    `EXT ${form.extra}`,
  ].join(' · ');
  return [
    {
      title: 'مشخصات قرارداد',
      fields: [
        ['شماره قرارداد', snapshot.contractNumber],
        ['طرف قرارداد', request.customerName],
        ['تلفن همراه', text(phone ?? customer?.maskedPrimaryContact)],
        ['تاریخ ثبت', dateTime(snapshot.createdAt)],
        ['شعبه', request.branchName],
        ['فروشنده', request.salesCounter],
        ['وضعیت', statusLabels[request.status]],
        ['آخرین اصلاح عملیاتی', date(request.correctedAt)],
      ],
    },
    {
      title: 'مسیر و خدمات',
      fields: [
        ['کشور', text(countryName)],
        ['شهر / مقصد', form.destination],
        ['تاریخ رفت', date(outbound?.departureAt ?? hotel?.checkInDate)],
        ['تاریخ برگشت', date(returning?.departureAt ?? hotel?.checkOutDate)],
        [
          'خدمات',
          snapshot.serviceSelections
            .map((service) => service.titleSnapshot)
            .join('، ') || unavailable,
        ],
        [
          'کارگزار',
          text(
            meta('supplierName') ??
              workflow.sentSupplierFormSettings?.text.broker,
          ),
        ],
        ['خریدار / مسئول رزرو', request.assignee ?? 'تخصیص‌نیافته'],
        [
          'ترانسفر',
          snapshot.serviceSelections.some(
            (service) => service.kind === 'TRANSFER',
          )
            ? 'دارد'
            : 'ندارد',
        ],
        ['راهنما', text(meta('tourLeader'))],
        ['وقت سفارت', text(meta('embassyAppointment'))],
      ],
    },
    {
      title: 'هتل و اتاق‌ها',
      fields: [
        ['نام هتل', form.hotel],
        ['درجه', form.stars],
        ['سرویس هتل', form.meal],
        ['نوع اتاق', form.roomType],
        ['ورود هتل', form.checkIn],
        ['خروج هتل', form.checkOut],
        ['تعداد و ترکیب اتاق‌ها', roomSummary],
        ['تعداد مسافران', form.passengers.length.toLocaleString('fa-IR')],
        [
          'رده سنی',
          `ADL ${form.adults} · CHD ${form.children} · INF ${form.infants}`,
        ],
        ['توضیح اتاق', text(request.hotelNotes ?? meta('roomNotes'))],
      ],
    },
    {
      title: 'پرواز',
      fields: [
        [
          'پرواز رفت',
          outbound
            ? `${outbound.carrierNameSnapshot} · ${outbound.serviceNumberSnapshot}`
            : unavailable,
        ],
        ['زمان رفت', dateTime(outbound?.departureAt)],
        [
          'پرواز برگشت',
          returning
            ? `${returning.carrierNameSnapshot} · ${returning.serviceNumberSnapshot}`
            : unavailable,
        ],
        ['زمان برگشت', dateTime(returning?.departureAt)],
        ['توضیح پرواز', text(meta('flightNotes'))],
      ],
    },
    {
      title: 'مبالغ ثبت‌شده',
      fields: [
        ['ارزها', prices.currencies],
        ['قیمت روز خدمات', prices.day],
        ['مبلغ توافقی خدمات', prices.agreed],
        ['تخفیف / اختلاف توافق', prices.discount],
        ['بدهکار ریالی', 'در اطلاعات ارسالی به رزرواسیون موجود نیست'],
        ['بدهکار ارزی', 'در اطلاعات ارسالی به رزرواسیون موجود نیست'],
        ['نرخ ارز', 'در اطلاعات ارسالی به رزرواسیون موجود نیست'],
      ],
    },
    {
      title: 'توضیحات و وضعیت عملیات',
      fields: [
        ['توضیح فروشنده', text(meta('reservationNote'))],
        ['سایر توضیحات', text(meta('notes'))],
        [
          'ارسال به کارگزار',
          ['REQUESTED', 'CONFIRMED'].includes(workflow.supplierStatus)
            ? 'انجام شده'
            : 'انجام نشده',
        ],
        ['واچر هتل', workflow.voucherIssued ? 'صادر شده' : 'صادر نشده'],
        [
          'بیمه',
          workflow.insuranceIssued
            ? `صادر شده · ${workflow.insuranceReference}`
            : 'صادر نشده',
        ],
      ],
    },
  ];
}

function LoadedDetails({
  intake,
  request,
}: {
  intake: ReservationFormIntake;
  request: RequestView;
}) {
  const refs = useReservationFormReferences(intake, true);
  const [customer, setCustomer] = useState<CustomerDetail>();
  const [country, setCountry] = useState('');
  useEffect(() => {
    let active = true;
    void customersApi
      .detail(intake.snapshot.customerId)
      .then(({ data }) => {
        if (active) setCustomer(data);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [intake.snapshot.customerId]);
  const city = refs.references[intake.snapshot.hotelSelection?.cityId ?? ''];
  const countryId = city?.attributes.countryId;
  useEffect(() => {
    if (typeof countryId !== 'string') return;
    let active = true;
    void masterDataApi
      .detail('countries', countryId)
      .then(({ data }) => {
        if (active) setCountry(text(data.attributes.englishName || data.name));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [countryId]);
  const groups = reservationGeneralDetailGroups(
    intake,
    request,
    refs.references,
    customer,
    country,
  );
  return (
    <div className={styles.groups}>
      {groups.map((group) => (
        <section key={group.title} className={styles.group}>
          <h3>{group.title}</h3>
          <dl>
            {group.fields.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

export function ReservationGeneralDetails({
  request,
}: {
  request: RequestView;
}) {
  const [intake, setIntake] = useState<ReservationFormIntake>();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void travelRequest<{ data: ReservationFormIntake }>(
      `reservations/requests/${request.id}/workflow`,
    )
      .then(({ data }) => {
        if (active) setIntake(data);
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : 'دریافت مشخصات ناموفق بود.',
          );
      });
    return () => {
      active = false;
    };
  }, [request.id]);
  if (error) return <p role="alert">{error}</p>;
  if (!intake) return <p role="status">در حال دریافت مشخصات کامل قرارداد…</p>;
  return <LoadedDetails intake={intake} request={request} />;
}
