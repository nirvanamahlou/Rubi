import type { DisplayLanguage } from './language';

const fa = {
  small: [
    'صفر',
    'یک',
    'دو',
    'سه',
    'چهار',
    'پنج',
    'شش',
    'هفت',
    'هشت',
    'نه',
    'ده',
    'یازده',
    'دوازده',
    'سیزده',
    'چهارده',
    'پانزده',
    'شانزده',
    'هفده',
    'هجده',
    'نوزده',
  ],
  tens: ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'],
  hundreds: [
    '',
    'صد',
    'دویست',
    'سیصد',
    'چهارصد',
    'پانصد',
    'ششصد',
    'هفتصد',
    'هشتصد',
    'نهصد',
  ],
  scales: ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون', 'هزار تریلیون'],
};
const en = {
  small: [
    'zero',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    'eleven',
    'twelve',
    'thirteen',
    'fourteen',
    'fifteen',
    'sixteen',
    'seventeen',
    'eighteen',
    'nineteen',
  ],
  tens: [
    '',
    '',
    'twenty',
    'thirty',
    'forty',
    'fifty',
    'sixty',
    'seventy',
    'eighty',
    'ninety',
  ],
  scales: ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion'],
};

function underThousand(value: number, language: DisplayLanguage): string {
  const words = language === 'en' ? en : fa;
  const rest = value % 100;
  const tail =
    rest < 20
      ? rest
        ? words.small[rest]!
        : ''
      : [
          words.tens[Math.floor(rest / 10)]!,
          rest % 10 ? words.small[rest % 10]! : '',
        ]
          .filter(Boolean)
          .join(language === 'en' ? '-' : ' و ');
  const hundred = Math.floor(value / 100);
  return [
    hundred
      ? language === 'en'
        ? `${en.small[hundred]} hundred`
        : fa.hundreds[hundred]!
      : '',
    tail,
  ]
    .filter(Boolean)
    .join(language === 'en' ? ' ' : ' و ');
}

function integerWords(value: bigint, language: DisplayLanguage): string {
  if (value === 0n) return language === 'en' ? en.small[0]! : fa.small[0]!;
  const parts: string[] = [];
  for (let scale = 0; value; scale++, value /= 1000n) {
    const group = Number(value % 1000n);
    if (!group) continue;
    const suffix = (language === 'en' ? en : fa).scales[scale]!;
    parts.unshift(
      language !== 'en' && scale === 1 && group === 1
        ? suffix
        : [underThousand(group, language), suffix].filter(Boolean).join(' '),
    );
  }
  return parts.join(language === 'en' ? ' ' : ' و ');
}

/** Decimal strings stay exact; never convert a complete monetary amount to Number. */
export function moneyInWords(
  value: string,
  currencyCode: string,
  language: DisplayLanguage = 'fa',
): string {
  let normalized = value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[,٬\s]/g, '')
    .replace(/٫/g, '.');
  if (/^\.\d/.test(normalized)) normalized = '0' + normalized;
  if (!/^\d{1,18}(?:\.\d{0,4})?$/.test(normalized)) return '';
  const [whole = '0', rawFraction = ''] = normalized.split('.');
  const fraction = rawFraction.replace(/0+$/, '');
  let result = integerWords(BigInt(whole), language);
  if (fraction)
    result +=
      language === 'en'
        ? ' point ' +
          [...fraction].map((digit) => en.small[Number(digit)]).join(' ')
        : ' ممیز ' +
          integerWords(BigInt(fraction), language) +
          ' ' +
          ['', 'دهم', 'صدم', 'هزارم', 'ده‌هزارم'][fraction.length];
  if (/^[A-Z]{3}$/.test(currencyCode)) {
    const currency =
      currencyCode === 'IRR'
        ? language === 'en'
          ? 'Iranian rials'
          : 'ریال'
        : new Intl.DisplayNames([language], { type: 'currency' }).of(
            currencyCode,
          );
    if (currency) result += ' ' + currency;
  }
  return result;
}
