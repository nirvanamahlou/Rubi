import type { TourDepartureV1, TourPackageV1 } from '@nora/contracts';

const number = new Intl.NumberFormat('fa-IR');
const date = new Intl.DateTimeFormat('fa-IR', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});

export function tourDepartureOptions(
  packages: readonly Pick<TourPackageV1, 'id' | 'name' | 'createdAt'>[],
  departures: readonly Pick<TourDepartureV1, 'id' | 'packageId' | 'startsOn'>[],
) {
  const groups = new Map<string, typeof packages[number][]>();
  for (const pack of packages) {
    const name = pack.name.trim();
    const group = groups.get(name) ?? [];
    group.push(pack);
    groups.set(name, group);
  }

  const labels = new Map<string, string>();
  for (const group of groups.values()) {
    const ids = new Set(group.map((pack) => pack.id));
    const scheduled = departures.filter((item) => ids.has(item.packageId)).sort(
      (a, b) => a.startsOn.localeCompare(b.startsOn) || a.id.localeCompare(b.id),
    );
    const schedules = new Map<string, string[]>();
    scheduled.forEach((item, index) => {
      const label = `نوبت ${number.format(index + 1)} (${date.format(new Date(item.startsOn))})`;
      const entries = schedules.get(item.packageId) ?? [];
      entries.push(label);
      schedules.set(item.packageId, entries);
    });
    const drafts = group
      .filter((pack) => !schedules.has(pack.id))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    drafts.forEach((pack, index) => {
      labels.set(pack.id, drafts.length > 1
        ? `تعریف ${number.format(index + 1)}، بدون نوبت ثبت‌شده`
        : 'بدون نوبت ثبت‌شده');
    });
    for (const [id, entries] of schedules) {
      labels.set(id, entries.join('، '));
    }
  }
  return packages.map(({ id, name }) => ({ id, name: `${name} · ${labels.get(id)}` }));
}
