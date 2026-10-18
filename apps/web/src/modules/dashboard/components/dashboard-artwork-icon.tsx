import {
  dashboardArtworkViewBox,
  type DashboardArtworkName,
} from '../model/artwork';

/** Decorative artwork; the adjacent KPI/chart title provides the accessible name. */
export function DashboardArtworkIcon({ name }: { name: DashboardArtworkName }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-dashboard-artwork={name}
      className="size-12 shrink-0 select-none"
      width={48}
      height={48}
      viewBox={dashboardArtworkViewBox(name)}
      preserveAspectRatio="xMidYMid meet"
      overflow="hidden"
    >
      <image
        href="/images/dashboard-icons/matte-enterprise-v1.png"
        width={1536}
        height={1024}
      />
    </svg>
  );
}
