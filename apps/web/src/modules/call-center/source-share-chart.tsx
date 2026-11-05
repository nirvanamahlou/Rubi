import { faNumber } from './model';
import styles from './source-share-chart.module.css';

const colors = [
  '#1459f5',
  '#32c96a',
  '#64c7ff',
  '#ffbd43',
  '#a78bfa',
  '#2ab8aa',
  '#f180ab',
  '#818cf8',
  '#f58a52',
];

export function sourceShareLayout(
  sources: { label: string; count: number }[],
  total: number,
) {
  let position = 0;
  return sources
    .filter((source) => source.count > 0)
    .map((source, index) => {
      const share = total > 0 ? source.count / total : 0;
      const start = position;
      position += share * 100;
      return {
        ...source,
        start,
        share,
        color: colors[index % colors.length]!,
      };
    });
}

export function SourceShareChart({
  sources,
  total,
}: {
  sources: { label: string; count: number }[];
  total: number;
}) {
  const items = sourceShareLayout(sources, total);
  const percent = (share: number) =>
    `${faNumber(Math.round(share * 1000) / 10)}٪`;
  return (
    <figure className={styles.chart}>
      <svg
        className={styles.ring}
        viewBox="0 0 200 200"
        direction="ltr"
        role="img"
        aria-label={`کل مخاطبان ${faNumber(total)}`}
      >
        <circle
          cx="100"
          cy="100"
          r="82"
          fill="none"
          className={styles.track}
          strokeWidth="34"
        />
        {items.map((item) => (
          <circle
            key={item.label}
            cx="100"
            cy="100"
            r="82"
            fill="none"
            stroke={item.color}
            strokeWidth="34"
            pathLength="100"
            strokeDasharray={`${item.share * 100} ${100 - item.share * 100}`}
            strokeDashoffset={-item.start}
            transform="rotate(-90 100 100)"
          >
            <title>{`${item.label}: ${faNumber(item.count)} (${percent(item.share)})`}</title>
          </circle>
        ))}
        <text x="100" y="97" textAnchor="middle" className={styles.total}>
          {faNumber(total)}
        </text>
        <text x="100" y="126" textAnchor="middle" className={styles.caption}>
          مخاطب
        </text>
      </svg>
      <figcaption className={styles.legend} dir="rtl">
        <ul>
          {items.map((item) => (
            <li key={item.label}>
              <span
                className={styles.swatch}
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              <bdi className={styles.label}>{item.label}</bdi>
              <span className={styles.values}>
                <bdi>{percent(item.share)}</bdi>
                <bdi className={styles.count}>({faNumber(item.count)})</bdi>
              </span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
