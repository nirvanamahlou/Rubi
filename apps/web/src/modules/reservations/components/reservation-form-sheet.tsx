'use client';
import { reservationFormPriceText } from '../model/reservation-form-price';
import { loadOutputReferences } from '../model/output-references';
import { getPublicApiBaseUrl } from '@/lib/environment';

import { reservationFormFooterHtml } from '../model/reservation-form-footer';
import Image from '@/i18n/image';
import { voucherFormData, supplierFormData } from '../model/voucher-settings';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { MasterDataResource } from '@nora/contracts';
import { salesContractFlights } from '@nora/contracts';
import { masterDataApi } from '@/modules/master-data/api/client';
import {
  reservationPassengerPages,
  reservationRoomAppendices,
  type ReservationFormIntake,
  type ReservationFormReferences,
} from '../model/reservation-form';
import styles from './reservation-form-sheet.module.css';
export function useReservationFormReferences(
  intake: ReservationFormIntake,
  active: boolean,
) {
  const [loaded, setLoaded] = useState<{
    key: string;
    references: ReservationFormReferences;
    failed: boolean;
  }>();
  const hotel = intake.snapshot.hotelSelection;
  const flights = salesContractFlights(
    intake.snapshot.serviceSelections,
    intake.snapshot.ticketSelections ?? [],
  );
  const entries = [
    hotel?.cityId
      ? ['cities', hotel.cityId]
      : flights[0]?.destinationId
        ? ['cities', flights[0].destinationId]
        : null,
    hotel ? ['hotels', hotel.hotelId] : null,
    hotel?.roomTypeId ? ['room-types', hotel.roomTypeId] : null,
    ...(hotel?.rooms ?? []).map((r) => ['room-types', r.roomTypeId]),
    hotel?.mealServiceId ? ['meal-services', hotel.mealServiceId] : null,
    ...flights.map((f) => ['airline-name', f.carrierNameSnapshot]),
  ].filter((entry): entry is string[] => !!entry);
  const key = JSON.stringify({ entries, requestId: intake.id });
  useEffect(() => {
    if (!active) return;
    let live = true;
    const requested = (
      JSON.parse(key) as { entries: [MasterDataResource, string][] }
    ).entries;
    void Promise.all(
      requested.map(async ([resource, id]) => {
        try {
          if (resource === ('airline-name' as MasterDataResource)) {
            const result = await masterDataApi.list(
              'airlines',
              {
                search: id,
                status: 'all',
                sortBy: 'name',
                sortDirection: 'asc',
                page: 1,
                pageSize: 100,
              },
              'reservations',
            );
            const data = result.data.find((record) =>
              [record.name, record.attributes.englishName].includes(id),
            );
            return { id, data };
          }
          const { data } = await masterDataApi.detail(
            resource,
            id,
            'reservations',
          );
          return { id, data };
        } catch {
          return { id, data: undefined };
        }
      }),
    ).then(async (results) => {
      const extra = await loadOutputReferences(async (path) => {
        const response = await fetch(getPublicApiBaseUrl() + path, {
          credentials: 'include',
          cache: 'no-store',
        });
        return response.ok ? response.json() : {};
      }, intake.id).catch(() => ({}));
      if (live)
        setLoaded({
          key,
          references: {
            ...extra,
            ...Object.fromEntries(
              results.flatMap((result) =>
                result.data ? [[result.id, result.data]] : [],
              ),
            ),
          },
          failed: results.some((result) => !result.data),
        });
    });
    return () => {
      live = false;
    };
  }, [key, active, intake.id]);
  return {
    references: loaded?.key === key ? loaded.references : {},
    ready: !active || loaded?.key === key,
    failed: loaded?.key === key && loaded.failed,
  };
}
function Heading({
  number,
  title,
  note,
}: {
  number: string;
  title: string;
  note: string;
}) {
  return (
    <div className={styles.heading}>
      <b>{number}</b>
      <strong>{title}</strong>
      <span>{note}</span>
    </div>
  );
}
const subscribeOrigin = () => () => {};
const browserOrigin = () => window.location.origin;
const serverOrigin = () => '';
export function ReservationFormSheet({
  intake,
  logo,
  references = {},
  voucher = false,
}: {
  intake: ReservationFormIntake;
  logo: string;
  references?: ReservationFormReferences;
  voucher?: boolean;
}) {
  const data = voucher
    ? voucherFormData(intake, references)
    : supplierFormData(intake, references);
  const settings = voucher
    ? intake.workflow.voucherSettings
    : intake.workflow.supplierFormSettings;
  const origin = useSyncExternalStore(
    subscribeOrigin,
    browserOrigin,
    serverOrigin,
  );
  const pages = voucher
    ? reservationPassengerPages(
        data.passengers,
        settings
          ? Math.max(
              6,
              8 - Math.ceil(Object.values(settings.text).join('').length / 350),
            )
          : 10,
      )
    : [data.passengers];
  const roomAppendices =
    !settings || settings.flags.hotel
      ? reservationRoomAppendices(data.roomBreakdown)
      : [];
  const pageCount = pages.length + roomAppendices.length;
  return (
    <div className={styles.document}>
      {pages.map((people, page) => {
        const first = pages
          .slice(0, page)
          .reduce((total, items) => total + items.length, 0);
        return (
          <article
            key={page}
            className={styles.page}
            dir="ltr"
            data-reservation-form-page
          >
            <header
              className={
                settings?.flags.withLetterhead === false
                  ? styles.plainHeader
                  : styles.header
              }
            >
              <div>
                <h1>{voucher ? 'HOTEL VOUCHER' : 'RESERVATION FORM'}</h1>
                <p>TRAVEL SERVICES / HOTEL / TRANSFER / TOUR LEADER</p>
              </div>
              <div
                className={`${styles.brand} ${intake.workflow.branding?.kind === 'OWN' && intake.workflow.branding.companyCode === 'JAHAN_BASTAN' ? styles.jahanBrand : ''}`}
              >
                {logo && settings?.flags.withLetterhead !== false && (
                  <Image
                    className={
                      intake.workflow.branding?.kind === 'OWN'
                        ? intake.workflow.branding.companyCode ===
                          'JAHAN_BASTAN'
                          ? styles.jahanLogo
                          : styles.logo
                        : styles.agencyLogo
                    }
                    src={
                      logo === '/brand/niyayesh-seir-full.png'
                        ? '/brand/niyayesh.png'
                        : logo
                    }
                    alt={data.brand}
                    width={196}
                    height={64}
                    unoptimized
                  />
                )}
              </div>
            </header>
            <div
              className={`${styles.meta} ${!voucher ? styles.metaWithPrice : ''}`}
            >
              {[
                [voucher ? 'BOOKING NO.' : 'REQUEST NO.', data.request],
                ['SUPPLIER', data.supplier],
                ...(!voucher
                  ? [
                      [
                        'PROPOSED PURCHASE PRICE',
                        reservationFormPriceText(
                          settings?.hotelPurchasePrices ?? [],
                          'code',
                        ) || '-',
                      ],
                    ]
                  : []),
                [voucher ? 'BOOKING DATE' : 'DATE OF ISSUE', data.issueDate],
                ['SERVICES', data.services],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <b dir="auto">{value}</b>
                </div>
              ))}
            </div>
            <section className={styles.bookingSection}>
              <Heading
                number="01"
                title="BOOKING SUMMARY"
                note="Reservation details"
              />
              <div className={styles.summary}>
                {[
                  ['ADULTS', data.adults],
                  ['CHILDREN 6-12', data.children6To12],
                  ['CHILDREN 2-6', data.children2To6],
                  ...(data.childrenUnclassified
                    ? [['CHILDREN (UNSPECIFIED)', data.childrenUnclassified]]
                    : []),
                  ['INFANTS', data.infants],
                  ['DESTINATION', data.destination],
                  [
                    'ROOMS / NIGHTS',
                    `${data.rooms} ROOMS / ${data.nights} NIGHTS`,
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <b dir="auto">{value}</b>
                  </div>
                ))}
              </div>
            </section>
            <Heading
              number="02"
              title="FLIGHT INFORMATION"
              note="Departure & return · Tehran time"
            />
            <table className={styles.table}>
              <thead>
                <tr>
                  {['AIRLINE', 'FLIGHT NO.', 'DATE', 'TIME'].map((t) => (
                    <th key={t}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data.flights.length
                  ? data.flights
                  : [
                      {
                        leg: '-',
                        airline: '-',
                        number: '-',
                        date: '-',
                        time: '-',
                      },
                    ]
                ).map((f, i) => (
                  <tr key={i}>
                    <td dir="auto">{f.airline}</td>
                    <td>{f.number}</td>
                    <td>{f.date}</td>
                    <td>{f.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!settings || settings.flags.hotel) && (
              <>
                <Heading
                  number="03"
                  title="HOTEL INFORMATION"
                  note="Accommodation"
                />
                <table className={styles.table}>
                  <colgroup>
                    <col
                      style={{
                        width: data.roomBreakdown.length ? '54%' : '34%',
                      }}
                    />
                    <col style={{ width: '19%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '15%' }} />
                    {!data.roomBreakdown.length && (
                      <col style={{ width: '20%' }} />
                    )}
                  </colgroup>
                  <thead>
                    <tr>
                      {[
                        'HOTEL',
                        'CITY',
                        'STAR',
                        'SERVICE',
                        ...(!data.roomBreakdown.length ? ['ROOM TYPE'] : []),
                      ].map((t) => (
                        <th key={t}>{t}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td dir="auto">{data.hotel}</td>
                      <td dir="auto">{data.destination}</td>
                      <td>{data.stars}</td>
                      <td dir="auto">{data.meal}</td>
                      {!data.roomBreakdown.length && (
                        <td dir="auto">{data.roomType}</td>
                      )}
                    </tr>
                  </tbody>
                </table>
                {data.roomBreakdown.length ? (
                  <table className={`${styles.table} ${styles.roomBreakdown}`}>
                    <caption>ROOM QUANTITIES BY TYPE</caption>
                    <thead>
                      <tr>
                        {[
                          'ROOM',
                          'ROOM TYPE',
                          'ADULTS',
                          'CHILD AGES',
                          'GUESTS',
                        ].map((t) => (
                          <th key={t}>{t}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.roomBreakdown.slice(0, 4).map((r) => (
                        <tr key={r.ordinal}>
                          <td>{r.ordinal}</td>
                          <td dir="auto">{r.roomType}</td>
                          <td>{r.adults}</td>
                          <td>{r.childAges.join(', ') || '-'}</td>
                          <td>{r.adults + r.childAges.length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
                <div className={styles.accommodationBreakdown}>
                  <table className={styles.table}>
                    <caption>STAY DATES</caption>
                    <thead>
                      <tr>
                        <th>CHECK-IN</th>
                        <th>CHECK-OUT</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{data.checkIn}</td>
                        <td>{data.checkOut}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <Heading
              number="04"
              title="TOUR SERVICES"
              note="Leader & excursion"
            />
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>TRANSFER</th>
                  <th>TOUR LEADER</th>
                  <th>EXCURSION</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    {data.transfer}
                    {voucher && (
                      <>
                        {' '}
                        · Board: {settings?.text.transferBoard?.trim() || '-'}
                      </>
                    )}
                  </td>
                  <td dir="auto">{data.leader}</td>
                  <td dir="auto">{data.excursion}</td>
                </tr>
              </tbody>
            </table>
            <Heading number="05" title="PASSENGERS" note="Passenger MANIFEST" />
            <table className={`${styles.table} ${styles.passengers}`}>
              <colgroup>
                <col style={{ width: '6%' }} />
                <col style={{ width: '56%' }} />
                <col style={{ width: '17%' }} />
                <col style={{ width: '21%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>#</th>
                  <th>SURNAME / NAME</th>
                  <th>SEX</th>
                  <th>AGE RATE</th>
                  {data.passengers.some((p) => p.checkIn !== undefined) && (
                    <>
                      <th>CHECK-IN</th>
                      <th>CHECK-OUT</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {people.length ? (
                  people.map((p, i) => (
                    <tr key={p.id}>
                      <td>{String(first + i + 1).padStart(2, '0')}</td>
                      <td dir="auto">{p.name}</td>
                      <td>{p.sex}</td>
                      <td>{p.age}</td>
                      {data.passengers.some((p) => p.checkIn !== undefined) && (
                        <>
                          <td>{p.checkIn ?? '—'}</td>
                          <td>{p.checkOut ?? '—'}</td>
                        </>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>-</td>
                  </tr>
                )}
              </tbody>
            </table>
            <Heading number="06" title="NOTICE" note="Notes & confirmation" />
            <div className={voucher ? styles.voucherClosing : undefined}>
              <div className={styles.notice}>
                <span>SPECIAL REQUESTS / REMARKS</span>
                <p dir="auto">{data.notes || '\u00a0'}</p>
                <div />
              </div>
              {voucher && (
                <div className={styles.stamp}>
                  <strong>STAMP</strong>
                </div>
              )}
            </div>
            <footer className={styles.footer}>
              {
                <div
                  data-reservation-footer
                  dangerouslySetInnerHTML={{
                    __html: reservationFormFooterHtml(
                      intake.id,
                      origin,
                      intake.workflow.branding?.companyCode,
                      data.brand,
                    ),
                  }}
                />
              }
              <div>
                <span>{''}</span>
              </div>
              <b>
                {page + 1} / {pageCount}
              </b>
            </footer>
          </article>
        );
      })}
      {roomAppendices.map((rooms, index) => (
        <article
          className={styles.page}
          key={`rooms-${index}`}
          dir="ltr"
          data-reservation-form-page
        >
          <header className={styles.header}>
            <h1>ROOM DETAILS</h1>
          </header>
          <p>
            {data.request} · {data.hotel} · {data.checkIn} / {data.checkOut}
          </p>
          <table className={styles.table}>
            <thead>
              <tr>
                {['ROOM', 'ROOM TYPE', 'ADULTS', 'CHILD AGES', 'GUESTS'].map(
                  (t) => (
                    <th key={t}>{t}</th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.ordinal}>
                  <td>{r.ordinal}</td>
                  <td dir="auto">{r.roomType}</td>
                  <td>{r.adults}</td>
                  <td>{r.childAges.join(', ') || '-'}</td>
                  <td>{r.adults + r.childAges.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <footer className={styles.footer}>
            <b>
              {pages.length + index + 1} / {pageCount}
            </b>
          </footer>
        </article>
      ))}
    </div>
  );
}
