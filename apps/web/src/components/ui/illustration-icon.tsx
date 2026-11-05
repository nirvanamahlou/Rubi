'use client';

import { useId, type ReactNode } from 'react';

export type IllustrationKind =
  | 'headset'
  | 'phone'
  | 'calendar'
  | 'callback'
  | 'unresolved'
  | 'home'
  | 'people'
  | 'cart'
  | 'coins'
  | 'folder'
  | 'mail'
  | 'settings'
  | 'chart'
  | 'layers'
  | 'clipboard'
  | 'search'
  | 'filter'
  | 'refresh'
  | 'building';

/** Decorative, local vector illustrations: no images, requests or accessible-name changes. */
export function IllustrationIcon({
  kind,
  size = 28,
  className,
}: {
  kind: IllustrationKind;
  size?: number;
  className?: string;
}) {
  const id = useId().replace(/:/g, '');
  const blue = `url(#${id}-blue)`;
  const pearl = `url(#${id}-pearl)`;
  const silver = `url(#${id}-silver)`;
  const ink = '#17355d';
  const handset = (
    <path
      d="M18 9c-3-1-9 5-9 9 0 15 22 37 37 37 4 0 10-6 9-9l-5-9c-1-2-4-3-6-1l-5 4c-5-3-12-10-15-15l4-5c2-2 1-5-1-6z"
      fill={blue}
      stroke="#2256b5"
      strokeWidth="1.5"
    />
  );
  const calendar = (
    <>
      <rect x="12" y="15" width="44" height="42" rx="8" fill={silver} />
      <rect
        x="8"
        y="11"
        width="44"
        height="42"
        rx="7"
        fill={pearl}
        stroke="#aac2e3"
      />
      <path d="M8 19a8 8 0 0 1 8-8h28a8 8 0 0 1 8 8v9H8z" fill={blue} />
      <path
        d="M19 8v12M40 8v12"
        stroke="#d6e8ff"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M17 35h6m6 0h6m6 0h4M17 43h6m6 0h6m6 0h4"
        stroke="#91afd3"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </>
  );
  const person = (x: number, y: number, scale = 1) => (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <circle cx="14" cy="11" r="9" fill={pearl} stroke="#9eb9dc" />
      <path
        d="M1 38v-5c0-10 6-14 13-14s13 4 13 14v5z"
        fill={blue}
        stroke="#2256b5"
      />
      <path
        d="M6 29c2-4 4-6 7-6"
        stroke="#a5ceff"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </g>
  );
  let art: ReactNode;
  switch (kind) {
    case 'phone':
      art = handset;
      break;
    case 'calendar':
      art = calendar;
      break;
    case 'headset':
      art = (
        <>
          <path
            d="M12 34V27a20 20 0 0 1 40 0v12"
            fill="none"
            stroke={ink}
            strokeWidth="7"
          />
          <path
            d="M13 29v-3a19 19 0 0 1 38 0v3"
            fill="none"
            stroke={pearl}
            strokeWidth="5"
          />
          <rect
            x="7"
            y="28"
            width="13"
            height="23"
            rx="6"
            fill={blue}
            stroke="#2256b5"
          />
          <rect
            x="44"
            y="28"
            width="13"
            height="23"
            rx="6"
            fill={blue}
            stroke="#2256b5"
          />
          <path
            d="M50 50c0 7-9 8-16 8"
            fill="none"
            stroke={ink}
            strokeWidth="4"
          />
          <rect x="26" y="54" width="12" height="6" rx="3" fill={silver} />
          <path
            d="M11 33v11M48 33v11"
            stroke="#a5ceff"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      );
      break;
    case 'callback':
    case 'refresh':
      art = (
        <>
          <path
            d="M13 26a20 20 0 0 1 34-11l4 4V8"
            fill="none"
            stroke={blue}
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M38 20h13M51 38a20 20 0 0 1-34 11l-4-4v11M26 44H13"
            fill="none"
            stroke={blue}
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M16 20c6-10 18-10 25-5M48 44c-6 10-18 10-25 5"
            fill="none"
            stroke="#a5ceff"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      );
      break;
    case 'unresolved':
      art = (
        <>
          <rect
            x="25"
            y="6"
            width="31"
            height="40"
            rx="5"
            fill={pearl}
            stroke="#a9bfdc"
          />
          <path
            d="M32 15h16M32 22h13M32 29h10"
            stroke="#8eafd7"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <g transform="translate(0 18) scale(.68)">{handset}</g>
          <circle
            cx="48"
            cy="48"
            r="12"
            fill={blue}
            stroke="#d4e6ff"
            strokeWidth="2"
          />
          <path
            d="m44 44 8 8m0-8-8 8"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </>
      );
      break;
    case 'home':
      art = (
        <>
          <path d="M13 29h38v28H13z" fill={pearl} stroke="#a1bce0" />
          <path
            d="m5 29 27-24 27 24-7 5L32 16 12 34z"
            fill={blue}
            stroke="#2256b5"
          />
          <path d="M26 57V37h13v20" fill={blue} />
          <path
            d="m10 27 22-19 22 19"
            fill="none"
            stroke="#9fc9ff"
            strokeWidth="2"
          />
        </>
      );
      break;
    case 'people':
      art = (
        <>
          {person(31, 13, 0.85)}
          {person(4, 6, 1.2)}
        </>
      );
      break;
    case 'cart':
      art = (
        <>
          <path
            d="M4 9h8l8 32h31l8-24H16"
            fill={pearl}
            stroke="#8faed7"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M22 23h28l-4 12H25z" fill={blue} />
          <path
            d="M20 42v5h30"
            fill="none"
            stroke={ink}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="24" cy="54" r="5" fill={blue} />
          <circle cx="46" cy="54" r="5" fill={blue} />
        </>
      );
      break;
    case 'coins':
      art = (
        <>
          {[0, 1, 2].map((n) => (
            <g key={n}>
              <path
                d={`M7 ${44 - n * 8}v7c0 8 27 8 27 0v-7`}
                fill={blue}
                stroke="#294f8e"
              />
              <ellipse
                cx="20.5"
                cy={44 - n * 8}
                rx="13.5"
                ry="5.5"
                fill={pearl}
                stroke="#8fafda"
              />
            </g>
          ))}
          {[0, 1, 2, 3].map((n) => (
            <g key={n}>
              <path
                d={`M31 ${38 - n * 8}v7c0 8 27 8 27 0v-7`}
                fill={silver}
                stroke="#8fafda"
              />
              <ellipse
                cx="44.5"
                cy={38 - n * 8}
                rx="13.5"
                ry="5.5"
                fill={pearl}
                stroke="#8fafda"
              />
            </g>
          ))}
        </>
      );
      break;
    case 'folder':
      art = (
        <>
          <path
            d="M7 15a6 6 0 0 1 6-6h13l7 8h17a6 6 0 0 1 6 6v30H7z"
            fill={blue}
          />
          <rect x="12" y="21" width="39" height="28" rx="3" fill={pearl} />
          <path d="M5 27h54l-5 28H9z" fill={silver} stroke="#a0b9da" />
          <rect x="24" y="36" width="16" height="7" rx="2" fill={pearl} />
        </>
      );
      break;
    case 'mail':
      art = (
        <>
          <rect
            x="7"
            y="15"
            width="50"
            height="37"
            rx="7"
            fill={silver}
            stroke="#9ab6da"
          />
          <path
            d="m9 18 23 19 23-19"
            fill={pearl}
            stroke="#3976d7"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="m10 48 14-14m30 14L40 34" stroke="#abc6e9" strokeWidth="2" />
        </>
      );
      break;
    case 'settings':
      art = (
        <>
          <path
            d="m27 5 10 0 2 8 7 3 7-3 6 9-6 5v9l6 5-6 9-8-3-6 3-2 9H27l-3-9-7-3-7 3-6-9 6-5v-9l-6-5 6-9 7 3 7-3z"
            fill={pearl}
            stroke="#8eafd7"
            strokeWidth="2"
          />
          <circle
            cx="32"
            cy="32"
            r="12"
            fill={blue}
            stroke="#daeaff"
            strokeWidth="3"
          />
          <circle cx="32" cy="32" r="5" fill={ink} />
        </>
      );
      break;
    case 'chart':
      art = (
        <>
          <path
            d="M8 8v48h50"
            fill="none"
            stroke="#91afd3"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {[0, 1, 2].map((n) => (
            <g key={n}>
              <rect
                x={15 + n * 15}
                y={36 - n * 13}
                width="10"
                height={19 + n * 13}
                rx="2"
                fill={blue}
              />
              <path
                d={`M${17 + n * 15} ${39 - n * 13}v${12 + n * 13}`}
                stroke="#a9ceff"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>
          ))}
        </>
      );
      break;
    case 'layers':
      art = (
        <>
          <path d="m5 41 27-13 27 13-27 15z" fill={blue} stroke="#2555a5" />
          <path d="m5 30 27-13 27 13-27 15z" fill={pearl} stroke="#93b5e1" />
          <path d="m5 19 27-13 27 13-27 15z" fill={blue} stroke="#2555a5" />
          <path
            d="m10 19 22-10 22 10"
            fill="none"
            stroke="#a5ceff"
            strokeWidth="2"
          />
        </>
      );
      break;
    case 'clipboard':
      art = (
        <>
          <rect x="12" y="11" width="42" height="48" rx="6" fill={blue} />
          <rect x="16" y="15" width="34" height="39" rx="3" fill={pearl} />
          <rect
            x="24"
            y="6"
            width="18"
            height="13"
            rx="4"
            fill={silver}
            stroke="#8faed7"
          />
          <path
            d="m21 30 3 3 5-6m-8 15 3 3 5-6"
            fill="none"
            stroke="#3976d7"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M34 31h10M34 43h10"
            stroke="#91afd3"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      );
      break;
    case 'search':
      art = (
        <>
          <path
            d="m41 41 15 15"
            stroke={blue}
            strokeWidth="10"
            strokeLinecap="round"
          />
          <circle
            cx="27"
            cy="27"
            r="19"
            fill={pearl}
            stroke={blue}
            strokeWidth="7"
          />
          <path
            d="M16 24a12 12 0 0 1 12-10"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      );
      break;
    case 'filter':
      art = (
        <>
          <path
            d="M7 12h50v7L38 37v18l-12-5V37L7 19z"
            fill={blue}
            stroke="#2256b5"
            strokeWidth="2"
          />
          <path d="M10 13h44v6H10z" fill={pearl} />
          <path
            d="m14 23 15 14v9"
            fill="none"
            stroke="#a5ceff"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      );
      break;
    case 'building':
      art = (
        <>
          <rect
            x="10"
            y="19"
            width="22"
            height="39"
            rx="3"
            fill={pearl}
            stroke="#8fafda"
          />
          <rect x="30" y="5" width="26" height="53" rx="3" fill={blue} />
          {[16, 27, 38].map((y) => (
            <path
              key={y}
              d={`M37 ${y}h4m5 0h4`}
              stroke="#d5e8ff"
              strokeWidth="4"
            />
          ))}
          <path d="M17 28h7m-7 11h7m-7 11h7" stroke="#80a6d8" strokeWidth="3" />
          <path d="M39 58V48h9v10" fill={ink} />
        </>
      );
      break;
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
      data-illustration={kind}
      style={{ flexShrink: 0, overflow: 'visible' }}
    >
      <defs>
        <linearGradient
          id={`${id}-blue`}
          x1="12"
          y1="6"
          x2="52"
          y2="60"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#94c5ff" />
          <stop offset=".38" stopColor="#397ff5" />
          <stop offset="1" stopColor="#1645b8" />
        </linearGradient>
        <linearGradient
          id={`${id}-pearl`}
          x1="15"
          y1="8"
          x2="48"
          y2="58"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#ffffff" />
          <stop offset=".55" stopColor="#e5effc" />
          <stop offset="1" stopColor="#a7c2e5" />
        </linearGradient>
        <linearGradient
          id={`${id}-silver`}
          x1="12"
          y1="10"
          x2="50"
          y2="59"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#eef5ff" />
          <stop offset=".6" stopColor="#adc7e9" />
          <stop offset="1" stopColor="#789bc9" />
        </linearGradient>
        <filter
          id={`${id}-shadow`}
          x="-25%"
          y="-20%"
          width="150%"
          height="155%"
        >
          <feDropShadow
            dx="0"
            dy="2"
            stdDeviation="1.5"
            floodColor="#123765"
            floodOpacity=".2"
          />
        </filter>
      </defs>
      <g filter={`url(#${id}-shadow)`}>{art}</g>
    </svg>
  );
}
