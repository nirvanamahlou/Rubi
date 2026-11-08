/** Day-level exclusion never deletes or changes source device punches. */
export function inactiveAttendance(row: { status?: string; data?: unknown }) {
  return (
    row.status === 'غیرفعال' ||
    (row.data as { attendanceActive?: boolean } | null)?.attendanceActive ===
      false
  );
}
export function attendanceForUse<
  T extends {
    section: string;
    tab: string;
    employeeId: string | null;
    values: unknown;
    status: string;
    data: unknown;
  },
>(rows: T[]): T[] {
  const excluded = new Set(
    rows
      .filter(
        (r) =>
          r.section === 'time' &&
          r.tab === 'attendance' &&
          inactiveAttendance(r),
      )
      .map((r) => `${r.employeeId}:${(r.values as string[])[1]}`),
  );
  return rows.filter(
    (r) =>
      !(
        r.section === 'time' &&
        ['attendance', 'checkins'].includes(r.tab) &&
        (inactiveAttendance(r) ||
          excluded.has(`${r.employeeId}:${(r.values as string[])[1]}`))
      ),
  );
}
