export interface NoteDraft {
  id: string;
  title: string;
  body: string;
  folder: string;
  tags: string;
  items: { text: string; done: boolean }[];
  pinned: boolean;
  updatedAt: string | null;
  template: boolean;
}

export const noteTemplates: NoteDraft[] = [
  {
    id: 'template-meeting',
    title: 'نکات جلسه فروش سازمانی',
    body: 'پیشنهاد خدمات سفر پاییز آماده شود.\nنیازهای تیم منابع انسانی مشتری بررسی شود.',
    folder: 'جلسات',
    tags: 'فروش، پیگیری',
    items: [],
    pinned: true,
    updatedAt: null,
    template: true,
  },
  {
    id: 'template-daily',
    title: 'چک‌لیست روزانه من',
    body: '',
    folder: 'شخصی',
    tags: 'روزانه',
    items: [
      'مرور درخواست‌های عقب‌افتاده',
      'بررسی پاسخ‌های واحد مالی',
      'هماهنگی با تیم رزرواسیون',
    ].map((text) => ({ text, done: false })),
    pinned: false,
    updatedAt: null,
    template: true,
  },
  {
    id: 'template-idea',
    title: 'ایده بهبود تحویل پرونده',
    body: 'اطلاعات ناقص قرارداد در یک چک‌لیست مشخص شود تا پیگیری آسان‌تر باشد.',
    folder: 'ایده‌ها',
    tags: 'فرایند',
    items: [],
    pinned: false,
    updatedAt: null,
    template: true,
  },
];

export function filterNoteDrafts(
  notes: NoteDraft[],
  search: string,
  folder: string,
  from: string,
  to: string,
) {
  const query = search.trim().toLocaleLowerCase('fa');
  return notes
    .filter(
      (note) =>
        (!folder || note.folder === folder) &&
        (!query ||
          [
            note.title,
            note.body,
            note.tags,
            ...note.items.map((item) => item.text),
          ]
            .join(' ')
            .toLocaleLowerCase('fa')
            .includes(query)) &&
        (!from ||
          Boolean(
            note.updatedAt && note.updatedAt.slice(0, 10) >= from.slice(0, 10),
          )) &&
        (!to ||
          Boolean(
            note.updatedAt && note.updatedAt.slice(0, 10) <= to.slice(0, 10),
          )),
    )
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''),
    );
}
