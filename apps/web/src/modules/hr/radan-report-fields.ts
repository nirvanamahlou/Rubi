import { persianDateToIso } from './hr-dates';
/** Field and choice structure observed in the authenticated Radan UI on 2026-10-25. */
export interface RadanCoefficientNode {
  label: string;
  children?: readonly RadanCoefficientNode[];
}
const leaves = (labels: readonly string[]) =>
  labels.map((label) => ({ label }));
export const radanCoefficientTree: readonly RadanCoefficientNode[] = [
  { label: 'کارکرد' },
  {
    label: 'اضافه کار',
    children: [
      ...leaves([
        'ساعتی',
        'اول وقت',
        'آخر وقت',
        'خارج وقت',
        'در مرخصی',
        'در ماموریت',
      ]),
      {
        label: 'اضافه کار غیر مجاز',
        children: leaves(['اول وقت', 'آخر وقت', 'خارج وقت']),
      },
      { label: 'اضافه کار روز تعطیل' },
    ],
  },
  {
    label: 'مرخصی',
    children: [
      {
        label: 'روزانه',
        children: leaves([
          'استحقاقی',
          'استعلاجی',
          'تشویقی',
          'بدون حقوق',
          'فوت بستگان درجه یک',
          'ازدواج',
          'زایمان',
        ]),
      },
      {
        label: 'ساعتی',
        children: leaves(['استحقاقی', 'استعلاجی', 'تشویقی', 'بدون حقوق']),
      },
    ],
  },
  {
    label: 'ماموریت',
    children: [
      {
        label: 'روزانه',
        children: leaves(['درون شهری', 'برون شهری', 'برون کشوری']),
      },
      { label: 'ساعتی', children: leaves(['درون شهری', 'برون شهری']) },
    ],
  },
  ...leaves(['فرجه', 'شناوری', 'شب کاری', 'جمعه کاری', 'تاخیر', 'تعجیل']),
  { label: 'غیبت', children: leaves(['روزانه', 'ساعتی']) },
  ...leaves(['تاخیر سرویس', 'دورکاری', 'ساعت ناهاری', 'گرد کردن ساعت کاری']),
  {
    label: 'نوبت کاری',
    children: leaves([
      'نوبت کاری 10 درصد',
      'نوبت کاری 15 درصد',
      'نوبت کاری 22.5 درصد',
    ]),
  },
];
export function coefficientPaths(
  nodes = radanCoefficientTree,
  parent = '',
): string[] {
  return nodes.flatMap((node) => {
    const path = parent ? `${parent} / ${node.label}` : node.label;
    return [path, ...coefficientPaths(node.children ?? [], path)];
  });
}
export function radanReportForm(id: string) {
  const noSort = [
    'calculation',
    'remote',
    'dailyMinutes',
    'totalMinutes',
    'present',
    'forgiveness',
    'arpa',
  ].includes(id);
  return {
    from: id !== 'presence',
    requiredFrom: !['people', 'incompleteDetail', 'presence'].includes(id),
    requiredGroups: [
      'remote',
      'dailyMinutes',
      'totalMinutes',
      'present',
      'forgiveness',
      'arpa',
    ].includes(id),
    sortOptions: noSort
      ? []
      : id === 'total'
        ? ['name', 'code']
        : id === 'people'
          ? ['name', 'code', 'identification']
          : ['name', 'lastName', 'code'],
    contractTypes: ['general', 'total'].includes(id),
    coefficients: id === 'general',
    peopleFields: id === 'people',
    units: id === 'total' ? ['default', 'clock', 'days'] : [],
    aggregate: [
      'late',
      'early',
      'absence',
      'mission',
      'leave',
      'overtime',
    ].includes(id),
  };
}

export function normalizeCoefficientSelection(
  paths: readonly string[],
): string[] {
  const selected = new Set(paths);
  const visit = (node: RadanCoefficientNode, parent: string): boolean => {
    const path = parent ? `${parent} / ${node.label}` : node.label;
    if (!node.children) return selected.has(path);
    const complete = node.children
      .map((child) => visit(child, path))
      .every(Boolean);
    if (complete) selected.add(path);
    else selected.delete(path);
    return complete;
  };
  radanCoefficientTree.forEach((node) => visit(node, ''));
  return coefficientPaths().filter((path) => selected.has(path));
}

export function radanDefaultReportRange(id: string, now = new Date()) {
  if (id !== 'general') return { from: '', to: '' };
  const parts = new Intl.DateTimeFormat('en-u-ca-persian', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((value) => value.type === type)?.value ?? '';
  return {
    from: persianDateToIso(`${part('year')}/${part('month')}/01`),
    to: persianDateToIso(`${part('year')}/${part('month')}/${part('day')}`),
  };
}
