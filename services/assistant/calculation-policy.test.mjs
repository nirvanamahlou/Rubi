import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CALCULATION_POLICY,
  calculationMetadataValid,
  explainedAnswerText,
} from './calculation-policy.mjs';
import { createAgentProvider } from './agent-provider.mjs';

test('one calculation rule covers every ERP domain without prescribing a table', () => {
  assert.match(CALCULATION_POLICY, /ALL ERP domains/);
  assert.match(CALCULATION_POLICY, /NO fixed table/);
  assert.match(CALCULATION_POLICY, /never private chain of thought/);
  assert.match(CALCULATION_POLICY, /ALL public prose, calculationExplanation/);
  assert.match(
    CALCULATION_POLICY,
    /Never expose English prose or internal tool\/schema\/column\/JSON names/,
  );
  assert.match(CALCULATION_POLICY, /non-cancelled is not automatically active/);
  for (const [text, explanation] of [
    [
      'اضافه‌کاری: ۹۰ دقیقه',
      'تردد مجاز همین کارمند در دو روز مشخص، ۳۰ + ۶۰ = ۹۰ دقیقه؛ تردد تأییدنشده کنار گذاشته شده است.',
    ],
    [
      'موجودی: ۷ واحد',
      '| مبنا | مقدار |\n| --- | --- |\n| ورودی تأییدشده | ۱۰ |\n| خروجی | ۳ |\nموجودی همین انبار: ۱۰ − ۳ = ۷ واحد.',
    ],
    [
      'وصول: ۱۲ USD',
      'فقط پرداخت تأییدشده در بازهٔ اعلام‌شده: ۵ + ۷ = ۱۲ USD؛ پرداخت معلق و سایر ارزها وارد جمع نشده‌اند.',
    ],
    [
      'نرخ تعریف‌نشده است',
      'تعداد کل موارد در این بازه صفر است؛ تقسیم بر مخرج صفر انجام نشده و درصدی قابل محاسبه نیست.',
    ],
  ]) {
    assert.equal(
      explainedAnswerText(
        { status: 'ANSWER', text, calculationExplanation: explanation },
        true,
      ),
      text + '\n\n' + explanation,
    );
    assert.equal(
      explainedAnswerText(
        {
          status: 'ANSWER',
          text: explanation,
          calculationExplanation: explanation,
        },
        true,
      ),
      explanation,
    );
  }
});

test('calculated answers cannot omit explanation or evade output bounds; non-calculations remain compatible', () => {
  assert.throws(
    () =>
      explainedAnswerText(
        { status: 'ANSWER', text: '۹۰', calculationExplanation: ' ' },
        true,
      ),
    /CALCULATION_EXPLANATION_REQUIRED/,
  );
  assert.throws(
    () =>
      explainedAnswerText(
        { status: 'ANSWER', text: '۹۰', calculationExplanation: {} },
        true,
      ),
    /INVALID_CALCULATION_EXPLANATION/,
  );
  assert.throws(
    () =>
      explainedAnswerText(
        {
          status: 'ANSWER',
          text: 'x'.repeat(5000),
          calculationExplanation: 'y'.repeat(2000),
        },
        true,
      ),
    /CALCULATION_EXPLANATION_TOO_LONG/,
  );
  assert.equal(
    explainedAnswerText({ status: 'REPLY', text: 'راهنمای کار' }, false),
    'راهنمای کار',
  );
  assert.equal(
    explainedAnswerText({ status: 'CLARIFY', text: 'کدام بازه؟' }, true),
    'کدام بازه؟',
  );
});

test('future tool metadata is bounded and contains operation identifiers, not private rows or instructions', () => {
  assert.equal(
    calculationMetadataValid({
      required: true,
      operations: ['count', 'inventory_balance'],
    }),
    true,
  );
  for (const value of [
    null,
    { required: 'yes', operations: [] },
    { required: true, operations: ['execute SQL'] },
    { required: true, operations: [], secret: 'x' },
  ])
    assert.equal(Boolean(calculationMetadataValid(value)), false);
});

test('native provider always receives the common rule and accepts model-authored calculation prose', async () => {
  let body;
  const provider = createAgentProvider({
    apiKey: 'synthetic',
    fetcher: async (_url, options) => {
      body = JSON.parse(options.body);
      return Response.json({
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: JSON.stringify({
                status: 'ANSWER',
                text: 'Synthetic',
                resultIds: [],
                limitations: [],
                calculationExplanation: 'Synthetic method',
              }),
            },
          },
        ],
        usage: { total_tokens: 10 },
      });
    },
  });
  const result = await provider.step([], {
    signal: new AbortController().signal,
    allowFinalResponse: true,
  });
  assert.equal(body.messages[0].content, CALCULATION_POLICY);
  assert.equal(result.args.calculationExplanation, 'Synthetic method');
});
