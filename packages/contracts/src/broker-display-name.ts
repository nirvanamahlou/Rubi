/** Display-only transcription for legacy records, never an official name or stored mutation. */
const letters: Readonly<Record<string, string>> = {
  ا: 'a',
  آ: 'a',
  أ: 'a',
  إ: 'e',
  ب: 'b',
  پ: 'p',
  ت: 't',
  ث: 's',
  ج: 'j',
  چ: 'ch',
  ح: 'h',
  خ: 'kh',
  د: 'd',
  ذ: 'z',
  ر: 'r',
  ز: 'z',
  ژ: 'zh',
  س: 's',
  ش: 'sh',
  ص: 's',
  ض: 'z',
  ط: 't',
  ظ: 'z',
  ع: 'a',
  غ: 'gh',
  ف: 'f',
  ق: 'gh',
  ک: 'k',
  ك: 'k',
  گ: 'g',
  ل: 'l',
  م: 'm',
  ن: 'n',
  و: 'v',
  ؤ: 'v',
  ه: 'h',
  ة: 'h',
  ی: 'i',
  ي: 'i',
  ى: 'a',
  ئ: 'i',
  ء: '',
};
const spelledLetters: Readonly<Record<string, string>> = {
  ا: 'A',
  ای: 'A',
  بی: 'B',
  سی: 'C',
  دی: 'D',
  ایی: 'E',
  اف: 'F',
  جی: 'G',
  اچ: 'H',
  آی: 'I',
  ج: 'J',
  ت: 'T',
  تی: 'T',
  کی: 'K',
  ال: 'L',
  ام: 'M',
  ان: 'N',
  او: 'O',
  پی: 'P',
  کیو: 'Q',
  آر: 'R',
  اس: 'S',
  یو: 'U',
  وی: 'V',
  دبلیو: 'W',
  ایکس: 'X',
  وای: 'Y',
  زد: 'Z',
};
const travelWords: Readonly<Record<string, string>> = {
  تور: 'Tour',
  توریسم: 'Tourism',
  تراول: 'Travel',
  توریست: 'Tourist',
  توریزم: 'Tourism',
};
const arabicScript =
  /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/u;

export function brokerEnglishDisplayName(record: {
  name: string;
  englishName?: unknown;
  code?: string;
}): string {
  const english =
    typeof record.englishName === 'string' ? record.englishName.trim() : '';
  if (english && !arabicScript.test(english)) return english;
  const name = record.name.trim();
  if (!arabicScript.test(name)) return name || record.code || 'Broker';
  const normalized = name
    .normalize('NFKC')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/[\u200c\u200d]/g, ' ')
    .replace(/[۰-۹٠-٩]/g, (digit) =>
      String(
        digit.charCodeAt(0) - (digit.charCodeAt(0) >= 0x06f0 ? 0x06f0 : 0x0660),
      ),
    );
  const result: string[] = [];
  let initialism = '';
  for (const word of normalized.split(/\s+/)) {
    if (Object.hasOwn(spelledLetters, word)) {
      initialism += spelledLetters[word];
      continue;
    }
    if (initialism) {
      result.push(initialism);
      initialism = '';
    }
    const transcribed = Object.hasOwn(travelWords, word)
      ? travelWords[word]!
      : [...word]
          .map((char) => letters[char] ?? (arabicScript.test(char) ? '' : char))
          .join('');
    if (transcribed)
      result.push(transcribed.replace(/^[a-z]/, (char) => char.toUpperCase()));
  }
  if (initialism) result.push(initialism);
  return result.join(' ').trim() || record.code || 'Broker';
}
