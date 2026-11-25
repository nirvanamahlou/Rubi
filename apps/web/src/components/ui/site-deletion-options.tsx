'use client';

const siteNames: Readonly<Record<string, string>> = {
  nss: 'نیایش سیر',
  'jahan-bastan': 'جهان باستان',
  ghestiroo: 'قسطی‌رو',
  'jahan-academy': 'جهان آکادمی',
};

export function SiteDeletionOptions({
  sites,
  selected,
  onChange,
  disabled,
  showAllDestinations = false,
}: {
  sites: string[];
  selected: string[];
  onChange: (sites: string[]) => void;
  disabled?: boolean;
  showAllDestinations?: boolean;
}) {
  if (!sites.length && !showAllDestinations) return null;
  const visibleSites = showAllDestinations
    ? ['nss', 'jahan-bastan', 'ghestiroo']
    : sites;
  return (
    <fieldset className="mt-4 space-y-2" disabled={disabled}>
      <legend className="mb-2 text-sm font-semibold">
        برای حذف، همه سایت‌های محل انتشار را انتخاب کنید.
      </legend>
      {visibleSites.map((site) => (
        <label key={site} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            disabled={!sites.includes(site)}
            checked={selected.includes(site)}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...selected, site]
                  : selected.filter((value) => value !== site),
              )
            }
          />
          {siteNames[site] ?? site}
          {!sites.includes(site) && <small>منتشر نشده</small>}
        </label>
      ))}
    </fieldset>
  );
}
