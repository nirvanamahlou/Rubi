import { createGroqProvider } from './groq-provider.mjs';
import { CONVERSATION_ACTIONS } from './orchestrator.mjs';

// No arbitrary input, history, ERP client or database. This CLI sends only fixed fictional requests.
if (
  process.argv.slice(2).length !== 1 ||
  process.argv[2] !== '--synthetic-only'
) {
  process.stderr.write(
    'Use --synthetic-only; no custom requests are accepted.\n',
  );
  process.exitCode = 1;
} else {
  const cases = [
    {
      id: 'daily',
      text: 'خلاصه امروز را نشان بده',
      expected: { kind: 'ACTION', action: 'daily-summary' },
    },
    {
      id: 'sales-dates',
      text: 'فروش از ۲۰۲۶-۱۰-۰۱ تا ۲۰۲۶-۱۰-۰۷ را تحلیل کن',
      expected: {
        kind: 'ACTION',
        action: 'sales-analysis',
        startDate: '2026-10-01',
        endDate: '2026-10-07',
      },
    },
    {
      id: 'balances',
      text: 'پیگیری مانده قراردادی را نشان بده',
      expected: { kind: 'ACTION', action: 'receivables-follow-up' },
    },
    {
      id: 'route-clarify',
      text: 'فروش مسیر استانبول را بررسی کن',
      expected: { kind: 'CLARIFY', field: 'ROUTE' },
    },
  ];
  let provider;
  try {
    provider = createGroqProvider({ apiKey: process.env.GROQ_API_KEY });
  } catch {
    process.stderr.write('PROVIDER_NOT_CONFIGURED\n');
    process.exitCode = 1;
  }
  if (provider)
    for (const item of cases) {
      const started = Date.now();
      try {
        const plan = await provider.plan({
          version: 1,
          message: item.text,
          history: [],
          actions: CONVERSATION_ACTIONS,
        });
        const passed = Object.entries(item.expected).every(
          ([key, value]) =>
            (key.endsWith('Date') ? plan.filters?.[key] : plan[key]) === value,
        );
        process.stdout.write(
          JSON.stringify({
            case: item.id,
            passed,
            durationMs: Date.now() - started,
          }) + '\n',
        );
        if (!passed) process.exitCode = 1;
      } catch (error) {
        const code = [
          'INVALID_PLAN',
          'PROVIDER_RATE_LIMITED',
          'CONVERSATION_TIMEOUT',
          'CONVERSATION_UNAVAILABLE',
        ].includes(error.message)
          ? error.message
          : 'CONVERSATION_UNAVAILABLE';
        process.stdout.write(
          JSON.stringify({
            case: item.id,
            passed: false,
            code,
            durationMs: Date.now() - started,
          }) + '\n',
        );
        process.exitCode = 1;
        break; // no retry and no further calls when quota/network/auth is unavailable.
      }
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
}
