export function readLeaveRequestFields(values: readonly string[]) {
  const [, leaveType, from, to, mode, startTime, endTime] = values;
  const hasTimeFields = values.length === 8;
  return {
    leaveType: leaveType as 'استحقاقی' | 'استعلاجی',
    from: from!,
    to: to!,
    mode: hasTimeFields ? (mode as 'روزانه' | 'ساعتی') : ('روزانه' as const),
    startTime: hasTimeFields ? startTime : undefined,
    endTime: hasTimeFields ? endTime : undefined,
  };
}

export function readAttendanceRequestComponent(
  tab: string,
  values: readonly string[],
) {
  if (tab === 'remote') {
    const [, , , mode] = values;
    return { category: 'دورکاری', mode: mode === 'ساعتی' ? 'ساعتی' : 'روزانه' };
  }
  if (
    tab !== 'radanMission' &&
    tab !== 'mission' &&
    tab !== 'radanLeave' &&
    tab !== 'leave'
  )
    return null;

  const [, , , , mode] = values;
  return {
    category: tab === 'radanMission' || tab === 'mission' ? 'مأموریت' : 'مرخصی',
    mode: mode === 'ساعتی' ? 'ساعتی' : 'روزانه',
  };
}
