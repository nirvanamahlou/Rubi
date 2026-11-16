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

/** Generated from validated native evidence, never from model prose/history. */
export function countBreakdownText(row, english = false) {
  if (english)
    return [
      'Calculation basis: all dates, selected company and your current authorized visible contracts; excludes hidden records and does not apply custom list filters.',
      '| Status | Count |',
      '| --- | --- |',
      `| Non-cancelled under the default panel list rules | ${row.panel_non_cancelled} |`,
      `| Cancelled in Sales | ${row.sales_cancelled} |`,
      `| Cancelled in latest Reservations lifecycle, but not in Sales | ${row.reservation_cancelled_only} |`,
      `| Total visible contracts | ${row.total} |`,
      `Total: ${row.panel_non_cancelled} + ${row.sales_cancelled} + ${row.reservation_cancelled_only} = ${row.total}`,
      `Active KPI: ${row.active_panel}; it additionally excludes ${row.completed_non_cancelled} completed contracts.`,
      'Use the same company and list filters when comparing. This table does not establish why a contract was cancelled.',
    ].join('\n');
  const n = (value) => new Intl.NumberFormat('fa-IR').format(value);
  return [
    'مبنای محاسبه: همه تاریخ‌ها، شرکت انتخاب‌شده و قراردادهای قابل مشاهده با دسترسی فعلی شما؛ بدون فیلترهای سفارشی فهرست و بدون قراردادهای پنهان.',
    '| وضعیت | تعداد |',
    '| --- | --- |',
    `| قراردادهای لغونشده طبق منطق پیش‌فرض فهرست پنل | ${n(row.panel_non_cancelled)} |`,
    `| لغوشده در فروش | ${n(row.sales_cancelled)} |`,
    `| لغوشده در آخرین وضعیت رزرواسیون، ولی لغونشده در فروش | ${n(row.reservation_cancelled_only)} |`,
    `| مجموع قراردادهای قابل مشاهده | ${n(row.total)} |`,
    `محاسبه مجموع: ${n(row.panel_non_cancelled)} + ${n(row.sales_cancelled)} + ${n(row.reservation_cancelled_only)} = ${n(row.total)}`,
    `کارت «قرارداد فعال»: ${n(row.active_panel)}؛ این کارت علاوه بر لغوشده‌ها، ${n(row.completed_non_cancelled)} قرارداد تکمیل‌شده را هم کنار می‌گذارد.`,
    'برای مقایسه، شرکت انتخاب‌شده و فیلترهای پنل باید یکسان باشند. این جدول علت لغو قراردادها را تعیین نمی‌کند.',
  ].join('\n');
}
