import type { Direction } from './model';

/** Decorative: the adjacent history text already names the call direction. */
export function CallHistoryIcon({ direction }: { direction: Direction }) {
  const incoming = direction === 'INBOUND';
  const color = incoming ? '#009b50' : '#0649d9';

  return (
    <svg
      viewBox="0 0 64 64"
      width="36"
      height="36"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="3"
        y="9"
        width="52"
        height="52"
        rx="15"
        fill={incoming ? '#dcfce7' : '#dbeafe'}
      />
      <path
        d="M18 9c-3-1-9 5-9 9 0 15 22 37 37 37 4 0 10-6 9-9l-5-9c-1-2-4-3-6-1l-5 4c-5-3-12-10-15-15l4-5c2-2 1-5-1-6z"
        transform="translate(4 13) scale(.72)"
        fill={color}
      />
      <circle
        cx="48"
        cy="16"
        r="14"
        fill={color}
        stroke="#fff"
        strokeWidth="2.5"
      />
      <path
        d={incoming ? 'M54 10 42 22m0-10v10h10' : 'M42 22 54 10H44m10 0v10'}
        fill="none"
        stroke="#fff"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
