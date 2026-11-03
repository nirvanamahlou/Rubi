import { faNumber } from './model';
import styles from './source-share-chart.module.css';

const colors = ['#17285e', '#2661ee', '#6491f5', '#9ab7fa', '#c5d5fc'];
const center = { x: 260, y: 180 };

export function sourceShareLayout(
  sources: { label: string; count: number }[],
  total: number,
) {
  let position = 0;
  const items = sources
    .filter((source) => source.count > 0)
    .map((source, index) => {
      const share = total > 0 ? source.count / total : 0;
      const start = position;
      position += share * 100;
      const radians = ((start + share * 50) / 100) * Math.PI * 2 - Math.PI / 2;
      const right = Math.cos(radians) >= 0;
      return {
        ...source,
        start,
        share,
        color:
          colors[
            Math.round(
              (index / Math.max(1, sources.length - 1)) * (colors.length - 1),
            )
          ]!,
        right,
        edgeX: center.x + Math.cos(radians) * 111,
        edgeY: center.y + Math.sin(radians) * 111,
        labelY: center.y + Math.sin(radians) * 128,
      };
    });
  // Spread clustered small slices independently on each side of the ring.
  for (const right of [false, true]) {
    const side = items
      .filter((item) => item.right === right)
      .sort((a, b) => a.labelY - b.labelY);
    const gap = Math.min(36, 288 / Math.max(1, side.length - 1));
    side.forEach((item, index) => {
      item.labelY = Math.max(
        36,
        item.labelY,
        index ? side[index - 1]!.labelY + gap : 36,
      );
    });
    for (let index = side.length - 1; index >= 0; index--) {
      side[index]!.labelY = Math.min(
        side[index]!.labelY,
        index === side.length - 1 ? 324 : side[index + 1]!.labelY - gap,
      );
    }
  }
  return items;
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
        viewBox="0 0 520 360"
        direction="ltr"
        role="img"
        aria-label={`کل مخاطبان ${faNumber(total)}`}
      >
        <circle
          cx={center.x}
          cy={center.y}
          r="99"
          fill="none"
          className={styles.track}
          strokeWidth="24"
        />
        {items.map((item) => (
          <circle
            key={item.label}
            cx={center.x}
            cy={center.y}
            r="99"
            fill="none"
            stroke={item.color}
            strokeWidth="24"
            pathLength="100"
            strokeDasharray={`${item.share * 100} ${100 - item.share * 100}`}
            strokeDashoffset={-item.start}
            transform={`rotate(-90 ${center.x} ${center.y})`}
          >
            <title>{`${item.label}: ${faNumber(item.count)} (${percent(item.share)})`}</title>
          </circle>
        ))}
        <text x={center.x} y="174" textAnchor="middle" className={styles.total}>
          {faNumber(total)}
        </text>
        <text
          x={center.x}
          y="202"
          textAnchor="middle"
          className={styles.caption}
        >
          کل مخاطبان
        </text>
        {items.map((item) => {
          const x = item.right ? 390 : 130;
          return (
            <g key={item.label}>
              <polyline
                points={`${item.edgeX},${item.edgeY} ${item.right ? 380 : 140},${item.labelY} ${x},${item.labelY}`}
                fill="none"
                className={styles.connector}
              />
              <text
                x={x}
                y={item.labelY - 7}
                textAnchor={item.right ? 'start' : 'end'}
                className={styles.label}
              >
                <tspan x={x}>{item.label}</tspan>
                <tspan
                  x={x}
                  dy="19"
                  direction="ltr"
                >{`${faNumber(item.count)} (${percent(item.share)})`}</tspan>
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className={styles.accessible}>
        {items
          .map(
            (item) =>
              `${item.label}: ${faNumber(item.count)} (${percent(item.share)})`,
          )
          .join('؛ ')}
      </figcaption>
    </figure>
  );
}
