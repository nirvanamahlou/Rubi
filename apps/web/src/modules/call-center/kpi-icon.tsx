'use client';

import { useId, type ReactNode } from 'react';

type KpiIconKind = 'today' | 'week' | 'withoutOutcome' | 'needsFollowUp';

/** Decorative illustrations scoped to the four Call Center KPI cards. */
export function CallKpiIcon({ kind }: { kind: KpiIconKind }) {
  const id = `call-kpi-${useId().replace(/:/g, '')}`;
  const blue = `url(#${id}-blue)`;
  const light = `url(#${id}-light)`;
  const handset = (
    <>
      <path
        d="M20 7c-3-3-11 1-14 7-4 9 4 23 14 33s24 18 33 14c6-3 10-11 7-14l-9-10c-2-2-5-2-7 0l-6 6c-7-3-14-10-17-17l6-6c2-2 2-5 0-7z"
        fill={blue}
        stroke="#1454f5"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path
        d="M20 7c-2-2-7 0-10 3-2 8 3 16 10 18l1-2 6-6c2-2 2-5 0-7z"
        fill={light}
        opacity=".66"
      />
    </>
  );
  let art: ReactNode;
  switch (kind) {
    case 'today':
      art = <g transform="translate(2 0) scale(.93)">{handset}</g>;
      break;
    case 'withoutOutcome':
      art = (
        <>
          <g transform="translate(0 1) scale(.84)">{handset}</g>
          <circle cx="48" cy="47" r="15" fill="var(--surface, #fff)" />
          <circle
            cx="48"
            cy="47"
            r="13"
            fill={blue}
            stroke="#1454f5"
            strokeWidth="1"
          />
          <path
            d="m43.5 42.5 9 9m0-9-9 9"
            stroke="#fff"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </>
      );
      break;
    case 'week':
      art = (
        <>
          <rect
            x="5"
            y="12"
            width="54"
            height="47"
            rx="11"
            fill={light}
            fillOpacity=".24"
            stroke="#6097ff"
            strokeWidth="1"
          />
          <path
            d="M5 27V23a11 11 0 0 1 11-11h32a11 11 0 0 1 11 11v4z"
            fill={blue}
          />
          <path d="M6 27h52" stroke="#1454f5" />
          <path
            d="M19 10v7m26-7v7"
            stroke="#8dbbff"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M19 10v7m26-7v7"
            stroke={light}
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M18 36h9m10 0h9M18 47h9m10 0h9"
            stroke={light}
            strokeWidth="5.5"
            strokeLinecap="round"
          />
        </>
      );
      break;
    case 'needsFollowUp':
      art = (
        <>
          <path
            d="M11 25A22 22 0 0 1 50 15l3 4M53 9v12H41"
            fill="none"
            stroke={light}
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M53 39A22 22 0 0 1 14 49l-3-4M11 55V43h12"
            fill="none"
            stroke={blue}
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
      break;
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="52"
      height="52"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
      data-call-kpi-icon={kind}
    >
      <defs>
        <linearGradient id={`${id}-blue`} x1="10%" y1="0%" x2="80%" y2="100%">
          <stop stopColor="#73b3ff" />
          <stop offset=".48" stopColor="#286dff" />
          <stop offset="1" stopColor="#0646ed" />
        </linearGradient>
        <linearGradient id={`${id}-light`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop stopColor="#cceaff" />
          <stop offset="1" stopColor="#76b4ff" />
        </linearGradient>
        <filter
          id={`${id}-shadow`}
          x="-20%"
          y="-15%"
          width="140%"
          height="145%"
        >
          <feDropShadow
            dx="0"
            dy="2"
            stdDeviation="1.3"
            floodColor="#1c55ad"
            floodOpacity=".13"
          />
        </filter>
      </defs>
      <g filter={`url(#${id}-shadow)`}>{art}</g>
    </svg>
  );
}
