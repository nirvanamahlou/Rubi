import { readFileSync } from 'node:fs';

const cards = JSON.parse(
  readFileSync(new URL('./erp-table-guide.json', import.meta.url), 'utf8'),
);

// These views project different grains from their underlying ERP tables.
const views = new Map([
  ['sales_contracts', 'contracts'],
  ['sales_contract_passengers', 'passengers'],
  ['sales_contract_services', 'services'],
  ['sales_contract_price_components', 'amounts'],
  ['sales_contract_payment_entries', 'payments'],
]);

const aliases = {
  sales_contracts: ['آخرین قرارداد', 'شماره قرارداد', 'قراردادهای فروش'],
  sales_contract_payment_entries: [
    'دریافت های تاییدشده',
    'دریافت های تایید شده',
    'اقساط قرارداد',
    'رسید مشتری',
  ],
  sales_contract_price_components: [
    'فروش خالص',
    'فروش ناخالص',
    'تخفیف قرارداد',
  ],
  reservation_ticket_documents: [
    'بلیت صادرشده',
    'بلیت های صادرشده',
    'بلیت های باطل شده',
  ],
  reservation_insurance_policies: ['بیمه نامه', 'بیمه مسافرتی'],
  hr_employees: ['کارکنان فعال', 'کارکنان سابق', 'پرسنل فعال'],
  customer_affairs_tickets: ['درخواست کارتابل', 'درخواست های کارتابل'],
};
function normalize(text) {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[أإ]/gu, 'ا')
    .replaceAll('ي', 'ی')
    .replaceAll('ك', 'ک')
    .replace(/[\u200c\s]+/gu, ' ')
    .trim();
}
function tokens(text) {
  return new Set(
    normalize(text)
      .split(/[^\p{L}\p{N}_]+/u)
      .map((word) => word.replace(/(?:Ù‡Ø§ÛŒ|Ù‡Ø§)$/u, ''))
      .filter(
        (word) =>
          word.length > 1 &&
          ![
            'Ø´Ø¯Ù‡',
            'Ø¨Ø±Ø§ÛŒ',
            'ØªØ¹Ø¯Ø§Ø¯',
            'Ú†Ù†Ø¯Ù‡',
            'Ù‡Ø§ÛŒ',
            'Ú¯Ø²Ø§Ø±Ø´',
          ].includes(word),
      ),
  );
}

const index = cards.map((card) => ({
  card,
  keywords: tokens([card.table, card.title, card.usage ?? ''].join(' ')),
  panel: tokens(card.feature),
}));

export function tableGuide(question, sources) {
  const terms = tokens(question);
  const phrase = normalize(question);
  const authorized = new Set(sources.map((item) => item.id));
  return index
    .map(({ card, keywords, panel }) => ({
      card,
      score:
        ((aliases[card.table] ?? []).some((alias) => phrase.includes(alias))
          ? 24
          : 0) +
        [...terms].reduce(
          (n, word) => n + (keywords.has(word) ? 4 : Number(panel.has(word))),
          0,
        ),
    }))
    .filter(({ score }) => score >= 4)
    .sort(
      (a, b) => b.score - a.score || a.card.table.localeCompare(b.card.table),
    )
    .slice(0, 4)
    .map(({ card }) => {
      const view = views.get(card.table);
      return {
        table: card.table,
        feature: card.feature,
        title: card.title,
        ...(card.usage ? { usage: card.usage } : {}),
        ...(authorized.has(view) ? { sqlSource: view } : {}),
      };
    });
}
