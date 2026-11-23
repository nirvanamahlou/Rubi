import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCompositeGuideSelector,
  validateCompositeGuide,
} from './composite-guide.mjs';

const question =
  'مسافرهای قرارداد آژانس را وارد کردم. برای پرواز و هتل قبل از ارسال چه چیزهایی را چک کنم؟';
const input = validateCompositeGuide({ version: 2, question });

test('synthetic Sales checklist has three canonical sources and validated excerpts', async () => {
  const selected = { flight: [2, 3, 4], hotel: [1, 2, 3, 4], review: [1, 3] };
  const selector = createCompositeGuideSelector({
    compositeEnabled: true,
    transport: {
      fetch: async (_url, request) => {
        const user = JSON.parse(JSON.parse(request.body).messages[1].content);
        assert.equal(user.question, question);
        assert.deepEqual(
          user.sections.map(({ id }) => id),
          Object.keys(selected),
        );
        return Response.json({
          choices: [{ message: { content: JSON.stringify(selected) } }],
        });
      },
    },
  });
  assert.deepEqual(await selector(input, new AbortController().signal), {
    version: 2,
    selected,
  });
});

test('a disabled flag or a missing required step uses the document fallback', async () => {
  const expected = { version: 2, selected: null };
  const signal = new AbortController().signal;
  assert.deepEqual(
    await createCompositeGuideSelector()(input, signal),
    expected,
  );
  const selector = createCompositeGuideSelector({
    compositeEnabled: true,
    transport: {
      fetch: async () =>
        Response.json({
          choices: [
            {
              message: {
                content: '{"flight":[2,3,4],"hotel":[1,2,3],"review":[1,3]}',
              },
            },
          ],
        }),
    },
  });
  assert.deepEqual(await selector(input, signal), expected);
  assert.throws(() =>
    validateCompositeGuide({ version: 2, question: question + ' قرارداد 123' }),
  );
});

test('fills omitted capacity recovery and registration-result steps from the guide', async () => {
  const selected = { flight: [2, 3, 4], hotel: [1, 2, 3, 4], review: [1, 3] };
  const cases = [
    [
      'اگر ظرفیت بلیت عوض شد چطور اصلاح کنم؟',
      { ...selected, flight: [2, 3, 4, 5] },
    ],
    [
      'بعد از ثبت از کجا شماره و نتیجه ثبت را ببینم؟',
      { ...selected, review: [1, 3, 4] },
    ],
  ];
  for (const [detail, expected] of cases) {
    const question =
      'قبل از ارسال قرارداد پرواز و هتل به رزرواسیون چه چیزهایی را بررسی کنم و ' +
      detail;
    let required;
    const selector = createCompositeGuideSelector({
      compositeEnabled: true,
      transport: {
        fetch: async (_url, request) => {
          required = JSON.parse(
            JSON.parse(request.body).messages[1].content,
          ).required;
          return Response.json({
            choices: [{ message: { content: JSON.stringify(selected) } }],
          });
        },
      },
    });
    assert.deepEqual(
      await selector(
        validateCompositeGuide({ version: 2, question }),
        new AbortController().signal,
      ),
      { version: 2, selected: expected },
    );
    assert.deepEqual(required, expected);
  }
});
