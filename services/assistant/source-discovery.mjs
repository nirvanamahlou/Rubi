// Only rank the native catalog supplied for the current authenticated request.
const topics = {
  contracts: [
    'قرارداد',
    'مشتری',
    'تاریخ رفت',
    'تاریخ تایید',
    'وضعیت فروش',
    'contract',
    'customer',
    'departure',
  ],
  amounts: [
    'مبلغ',
    'فروش',
    'تخفیف',
    'ارز',
    'قیمت',
    'amount',
    'sales',
    'discount',
    'currency',
    'price',
  ],
  payments: [
    'پرداخت',
    'وصول',
    'دریافت وجه',
    'قسط',
    'اقساط',
    'دریافتی',
    'payment',
    'receipt',
    'collected',
    'installment',
  ],
  passengers: [
    'مسافر',
    'بزرگسال',
    'کودک',
    'نوزاد',
    'passenger',
    'adult',
    'child',
    'infant',
  ],
  services: [
    'خدمت',
    'خدمات',
    'سرویس',
    'بیمه',
    'ترانسفر',
    'service',
    'insurance',
    'transfer',
  ],
};

const labels = {
  contracts: 'قرارداد، خریدار، تاریخ و وضعیت فروش',
  passengers: 'مسافران قرارداد و گروه سنی',
  services: 'خدمات انتخاب‌شده در فروش',
  amounts: 'مبلغ قراردادی پس از تخفیف، به تفکیک ارز',
  payments: 'اقساط، پرداخت‌های ثبت‌شده و وضعیت تأیید',
};

function normalize(text) {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replaceAll('ي', 'ی')
    .replaceAll('ك', 'ک')
    .replace(/[\u064B-\u065F]/gu, '')
    .replace(/[\u200c\s]+/gu, ' ')
    .trim();
}

export function findSources(question, authorized) {
  const text = normalize(question);
  const candidates = authorized.map((source) => {
    const score = (topics[source.id] ?? []).reduce(
      (total, term) => total + Number(text.includes(term)),
      0,
    );
    const contractLookup =
      source.id === 'contracts' &&
      /(?:[a-z]+-\d+|[۰-۹٠-٩0-9]{5,})/iu.test(text);
    return { source, score: score + Number(contractLookup) };
  });
  const matches = candidates
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return matches.slice(0, 3).map((item) => item.source);
}

export function sourceCards(question, authorized) {
  const matches = findSources(question, authorized);
  return matches.map(({ id }) => ({ id, description: labels[id] }));
}
