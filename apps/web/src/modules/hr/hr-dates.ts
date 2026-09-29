const normalizeDigits = (value: string) =>
  value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));

function convertPersianDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  const match = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(
    normalizeDigits(value.trim()),
  );
  if (!match) return value;
  const target = `${match[1]}-${match[2]?.padStart(2, '0')}-${match[3]?.padStart(2, '0')}`;
  const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const start = new Date(Number(match[1]) + 620, 0, 1, 12);
  const end = new Date(Number(match[1]) + 622, 11, 31, 12);
  for (let date = start; date <= end; date.setDate(date.getDate() + 1)) {
    const parts = formatter.formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((item) => item.type === type)?.value.padStart(2, '0') ?? '';
    if (`${part('year')}-${part('month')}-${part('day')}` === target) {
      const year = String(date.getFullYear());
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  return value;
}

const convertedDates = new Map<string, string>();
export function persianDateToIso(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  const cached = convertedDates.get(value);
  if (cached !== undefined) return cached;
  const result = convertPersianDate(value);
  if (convertedDates.size >= 256) convertedDates.clear();
  convertedDates.set(value, result);
  return result;
}
