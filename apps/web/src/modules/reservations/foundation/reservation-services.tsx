import type { RequestView } from './model';
import { serviceLabels } from './model';
import styles from './workspace.module.css';

const categories: Record<string, string> = {
  ...serviceLabels,
  FLIGHT: 'پرواز',
  TRANSFER: 'ترانسفر',
  VISA: 'ویزا',
  TOUR: 'تور',
  GUIDE: 'راهنما',
  EXCURSION: 'گشت',
  CIP: 'CIP',
};

const categoryOrder = [
  'HOTEL',
  'FLIGHT',
  'TRANSFER',
  'TRAIN',
  'BUS',
  'INSURANCE',
  'VISA',
  'TOUR',
  'GUIDE',
  'EXCURSION',
  'CIP',
  'OTHER',
];

export function reservationServiceGroups(row: RequestView) {
  // Old local views do not have kind/title pairs. Keep their titles rather
  // than guessing categories from words in a localized service name.
  const items = row.serviceItems?.length
    ? row.serviceItems
    : row.serviceTitles?.length
      ? row.serviceTitles.map((title) => ({ kind: 'OTHER', title }))
      : row.services.map((kind) => ({ kind, title: '' }));
  const groups = new Map<
    string,
    { kind: string; label: string; titles: string[] }
  >();
  for (const item of items) {
    const kind = Object.hasOwn(categories, item.kind) ? item.kind : 'OTHER';
    const group = groups.get(kind) ?? {
      kind,
      label: categories[kind]!,
      titles: [],
    };
    const title = item.title.trim();
    if (
      title &&
      title !== group.label &&
      !(kind === 'HOTEL' && title === 'اقامت هتل') &&
      !group.titles.includes(title)
    ) {
      group.titles.push(title);
    }
    groups.set(kind, group);
  }
  return categoryOrder.flatMap((kind) => {
    const group = groups.get(kind);
    return group ? [group] : [];
  });
}

export function ReservationServices({ row }: { row: RequestView }) {
  const groups = reservationServiceGroups(row);
  if (!groups.length) return <bdi>—</bdi>;
  return (
    <ul className={styles.serviceGroups}>
      {groups.map((group) => (
        <li key={group.kind}>
          <strong>{group.label}</strong>
          {group.titles.length > 0 && (
            <span>
              {group.titles.map((title, index) => (
                <bdi key={title}>
                  {index > 0 && '، '}
                  {title}
                </bdi>
              ))}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
