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
}: {
  sites: string[];
  selected: string[];
  onChange: (sites: string[]) => void;
  disabled?: boolean;
}) {
  if (!sites.length) return null;
  return (
    <fieldset className="mt-4 space-y-2" disabled={disabled}>
      <legend className="mb-2 text-sm font-semibold">
        برای حذف، همه سایت‌های محل انتشار را انتخاب کنید.
      </legend>
      {sites.map((site) => (
        <label key={site} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
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
        </label>
      ))}
    </fieldset>
  );
}
