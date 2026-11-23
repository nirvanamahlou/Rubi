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
  const selected = { flight: [0], hotel: [0], review: [0] };
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

test('flag off and invalid model output use the document fallback', async () => {
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
              message: { content: '{"flight":[100],"hotel":[0],"review":[0]}' },
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
