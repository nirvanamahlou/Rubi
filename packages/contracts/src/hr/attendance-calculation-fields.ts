/** V1 slots are persisted. Keep each index when changing labels or presentation. */
export const HR_ATTENDANCE_CALCULATION_FIELDS_V1 = (
  [
    { id: 'title', index: 0, label: 'عنوان تنظیمات', kind: 'text' },
    { id: 'components', index: 1, label: 'اجزای کارکرد', kind: 'components' },
    {
      id: 'leaveUsesShiftLength',
      index: 2,
      label: 'مرخصی بر اساس طول شیفت',
      kind: 'flag',
    },
    {
      id: 'dailyLeaveMinutes',
      index: 3,
      label: 'طول مرخصی روزانه به دقیقه',
      kind: 'minutes',
    },
    {
      id: 'creditOutsideMission',
      index: 4,
      label: 'مأموریت خارج ساعت کاری اضافه‌کار',
      kind: 'flag',
    },
    {
      id: 'subtractDeficit',
      index: 5,
      label: 'کسر کسرکار از اضافه‌کار',
      kind: 'flag',
    },
    {
      id: 'thursdayOvertime',
      index: 6,
      label: 'اضافه‌کار پنجشنبه',
      kind: 'flag',
    },
    { id: 'fridayOvertime', index: 7, label: 'اضافه‌کار جمعه', kind: 'flag' },
    {
      id: 'includeHolidayOvertime',
      index: 8,
      label: 'افزودن اضافه‌کار تعطیل',
      kind: 'flag',
    },
    { id: 'basis', index: 9, label: 'مبنای محاسبات', kind: 'basis' },
  ] as const
).toSorted((a, b) => a.index - b.index);

type CalculationFieldId =
  (typeof HR_ATTENDANCE_CALCULATION_FIELDS_V1)[number]['id'];

export function readHrAttendanceCalculationV1(
  values: readonly string[],
): Record<CalculationFieldId, string> {
  return Object.fromEntries(
    HR_ATTENDANCE_CALCULATION_FIELDS_V1.map(({ id, index }) => [
      id,
      values[index] ?? '',
    ]),
  ) as Record<CalculationFieldId, string>;
}
