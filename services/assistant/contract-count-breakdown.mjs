const keys = [
  'panel_non_cancelled',
  'sales_cancelled',
  'reservation_cancelled_only',
  'completed_non_cancelled',
  'active_panel',
  'total',
];

export function validCountBreakdown(rows) {
  if (!Array.isArray(rows) || rows.length !== 1) return false;
  const row = rows[0];
  return (
    row &&
    Object.keys(row).length === keys.length &&
    keys.every((key) => Number.isSafeInteger(row[key]) && row[key] >= 0) &&
    row.panel_non_cancelled +
      row.sales_cancelled +
      row.reservation_cancelled_only ===
      row.total &&
    row.active_panel + row.completed_non_cancelled === row.panel_non_cancelled
  );
}
