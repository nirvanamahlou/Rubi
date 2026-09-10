'use client';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import type { MasterDataResource } from '@rubi/contracts';
import { salesContractFlights } from '@rubi/contracts';
import { masterDataApi } from '@/modules/master-data/api/client';
import {
  reservationFormData,
  reservationPassengerPages,
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
    hotel?.mealServiceId ? ['meal-services', hotel.mealServiceId] : null,
  ].filter((entry): entry is string[] => !!entry);
  const key = JSON.stringify(entries);
  useEffect(() => {
    if (!active) return;
    let live = true;
    const requested = JSON.parse(key) as [MasterDataResource, string][];
    void Promise.all(
      requested.map(async ([resource, id]) => {
        try {
          const { data } = await masterDataApi.detail(resource, id);
          return { id, data };
        } catch {
          return { id, data: undefined };
        }
      }),
    ).then((results) => {
      if (live)
        setLoaded({
          key,
          references: Object.fromEntries(
            results.flatMap((result) =>
              result.data ? [[result.id, result.data]] : [],
            ),
          ),
          failed: results.some((result) => !result.data),
        });
    });
    return () => {
      live = false;
    };
  }, [key, active]);
  return {
    references: loaded?.key === key ? loaded.references : {},
    ready: !active || !entries.length || loaded?.key === key,
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
export function ReservationFormSheet({
  intake,
  logo,
  references = {},
}: {
  intake: ReservationFormIntake;
  logo: string;
  references?: ReservationFormReferences;
}) {
  const data = reservationFormData(intake, references);
  const pages = reservationPassengerPages(data.passengers);
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
            <header className={styles.header}>
              <div>
                <h1>RESERVATION FORM</h1>
                <p>TRAVEL SERVICES / HOTEL / TRANSFER / TOUR LEADER</p>
              </div>
              <div className={styles.brand}>
                {logo && (
                  <Image
                    className={
                      intake.workflow.branding?.kind === 'OWN'
                        ? styles.logo
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
            <div className={styles.meta}>
              {[
                ['REQUEST NO.', data.request],
                ['SUPPLIER', data.supplier],
                ['DATE OF ISSUE', data.issueDate],
                ['SERVICES', data.services],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <b dir="auto">{value}</b>
                </div>
              ))}
            </div>
            <Heading
              number="01"
              title="BOOKING SUMMARY"
              note="Reservation details"
            />
            <div className={styles.summary}>
              {[
                ['ADULTS', data.adults],
                ['CHILDREN', data.children],
                ['INFANTS', data.infants],
                ['DESTINATION', data.destination],
                [
                  'ROOMS / NIGHTS',
                  `${data.rooms} ROOMS / ${data.nights} NIGHTS`,
                ],
                ['TOUR LEADER', data.leader],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <b dir="auto">{value}</b>
                </div>
              ))}
            </div>
            <Heading
              number="02"
              title="FLIGHT INFORMATION"
              note="Departure & return · Tehran time"
            />
            <table className={styles.table}>
              <thead>
                <tr>
                  {['LEG', 'AIRLINE', 'FLIGHT NO.', 'DATE', 'TIME'].map((t) => (
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
                    <td>{f.leg}</td>
                    <td dir="auto">{f.airline}</td>
                    <td>{f.number}</td>
                    <td>{f.date}</td>
                    <td>{f.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Heading
              number="03"
              title="HOTEL INFORMATION"
              note="Accommodation"
            />
            <table className={styles.table}>
              <colgroup>
                <col style={{ width: '34%' }} />
                <col style={{ width: '19%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '20%' }} />
              </colgroup>
              <thead>
                <tr>
                  {['HOTEL', 'CITY', 'STAR', 'SERVICE', 'ROOM TYPE'].map(
                    (t) => (
                      <th key={t}>{t}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td dir="auto">{data.hotel}</td>
                  <td dir="auto">{data.destination}</td>
                  <td>{data.stars}</td>
                  <td dir="auto">{data.meal}</td>
                  <td dir="auto">{data.roomType}</td>
                </tr>
              </tbody>
            </table>
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
              <table className={`${styles.table} ${styles.roomCounts}`}>
                <caption>ROOM QUANTITIES BY TYPE</caption>
                <thead>
                  <tr>
                    <th>DBL · DOUBLE</th>
                    <th>SGL · SINGLE</th>
                    <th>EXT · EXTRA BED</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{data.double}</td>
                    <td>{data.single}</td>
                    <td>{data.extra}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <Heading
              number="04"
              title="TOUR SERVICES"
              note="Leader & excursion"
            />
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>TOUR LEADER</th>
                  <th>EXCURSION</th>
                </tr>
              </thead>
              <tbody>
                <tr>
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
            <div className={styles.notice}>
              <span>SPECIAL REQUESTS / REMARKS</span>
              <p dir="auto">{data.notes || '\u00a0'}</p>
              <div />
            </div>
            <footer className={styles.footer}>
              <div>
                <strong dir="auto">{data.brand}</strong>
                <span>
                  Reservation request - subject to supplier confirmation.
                </span>
              </div>
              <b>
                {page + 1} / {pages.length}
              </b>
            </footer>
          </article>
        );
      })}
    </div>
  );
}
