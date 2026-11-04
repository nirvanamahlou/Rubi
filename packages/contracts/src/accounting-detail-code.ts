export function detailDigits(value: string): string {
  return value
    .trim()
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

export function detailTypeKey(title: string): string {
  return title
    .trim()
    .replaceAll('ي', 'ی')
    .replaceAll('ك', 'ک')
    .replace(/[\s\u200c]+/g, ' ')
    .toLowerCase();
}

export function detailWidth(raw: unknown): number | null {
  const digits = detailDigits(String(raw ?? ''));
  return /^(?:[1-9]|1\d|20)$/.test(digits) ? Number(digits) : null;
}

export function paddedDetailCode(raw: string, width: number): string | null {
  const digits = detailDigits(raw);
  if (!/^\d{1,20}$/.test(digits) || digits.length > width) return null;
  return digits.padStart(width, '0');
}

export function nextDetailCode(
  width: number,
  first: string,
  codes: readonly string[],
): string | null {
  const start = paddedDetailCode(first || '0', width);
  if (!start) return null;
  const occupied = new Set(codes.map((code) => paddedDetailCode(code, width)));
  let value = BigInt(start);
  let code = start;
  while (occupied.has(code)) {
    value += BigInt(1);
    code = value.toString().padStart(width, '0');
  }
  return code.length === width ? code : null;
}
