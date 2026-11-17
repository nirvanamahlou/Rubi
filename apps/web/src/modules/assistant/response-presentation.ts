import { assistantCopy as c } from '@/i18n/assistant-copy';

const publicTerms: Record<string, string> = {
  panel_non_cancelled: c.termNonCancelled[0],
  sales_cancelled: c.termSalesCancelled[0],
  reservation_cancelled_only: c.termReservationCancelled[0],
  completed_non_cancelled: c.termCompleted[0],
  active_panel: 'قراردادهای فعال',
  contract_count_breakdown: c.termCount[0],
  currency_code: 'ارز',
  contract_number: 'شماره قرارداد',
  sales_status: 'وضعیت فروش',
  reservation_status: 'وضعیت رزرواسیون',
};
const termPattern = new RegExp(
  `\\b(${Object.keys(publicTerms).join('|')})\\b`,
  'g',
);

/** Presentation only: never rewrite numeric operands, record IDs or arbitrary names. */
export function persianAssistantTerms(text: string) {
  return text.replace(termPattern, (term) => publicTerms[term]!);
}

export function formatAssistantSources(
  sources: readonly {
    kind?: string | undefined;
    sources: readonly string[];
    observedAt: string;
  }[],
  english = false,
) {
  const language = english ? 1 : 0;
  const names: Record<string, readonly [string, string]> = {
    contracts: c.sourceContracts,
    passengers: c.sourcePassengers,
    services: c.sourceServices,
    amounts: c.sourceAmounts,
    payments: c.sourcePayments,
  };
  return sources
    .map((source) => {
      const label =
        source.kind === 'panel-count-breakdown'
          ? c.sourceCountBreakdown[language]
          : [
              ...new Set(
                source.sources.map(
                  (id) => (names[id] ?? c.sourceAuthorized)[language],
                ),
              ),
            ].join('، ');
      const date = new Date(source.observedAt);
      if (!Number.isFinite(date.getTime()))
        return `${label}\n${c.sourceTimeUnavailable[language]}`;
      const locale = english ? 'en-GB' : 'fa-IR';
      return `${label}\n${c.sourceDate[language]}: ${date.toLocaleDateString(locale, { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' })}\n${c.sourceTime[language]}: ${date.toLocaleTimeString(locale, { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`;
    })
    .join('\n\n');
}
