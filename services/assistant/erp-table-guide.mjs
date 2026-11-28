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

function tokens(text) {
  return new Set(
    text
      .normalize('NFKC')
      .toLowerCase()
      .replaceAll('ي', 'ی')
      .replaceAll('ك', 'ک')
      .split(/[^\p{L}\p{N}_]+/u)
      .map((word) => word.replace(/(?:های|ها)$/u, ''))
      .filter(
        (word) =>
          word.length > 1 &&
          !['شده', 'برای', 'تعداد', 'چنده', 'های', 'گزارش'].includes(word),
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
  const authorized = new Set(sources.map((item) => item.id));
  return index
    .map(({ card, keywords, panel }) => ({
      card,
      score: [...terms].reduce(
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
