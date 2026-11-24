import { describe, expect, it } from 'vitest';
import { assistantGuideCatalogues } from './assistant-guide-registry';
import { retrieveSalesPanelGuide } from './panel-guide-retrieval';

describe('Sales panel guides', () => {
  for (const domain of [
    'marketing',
    'package-management',
    'floating-packages',
  ] as const) {
    for (const section of assistantGuideCatalogues[domain].topics) {
      it(
        'answers both examples and the follow-up for ' + section.guideHref,
        () => {
          for (const example of section.examples)
            expect(
              retrieveSalesPanelGuide(example, '/workbench'),
            ).toMatchObject({ guideHref: section.guideHref });
          expect(
            retrieveSalesPanelGuide('بعدش چی؟', '/sales', section.guideHref),
          ).toMatchObject({ guideHref: section.guideHref });
        },
      );
    }
  }
  it('leaves generator and contract questions to their original guides', () => {
    expect(
      retrieveSalesPanelGuide('چطور بنر پک جنریتور بگیرم؟', '/marketing'),
    ).toBeUndefined();
    expect(
      retrieveSalesPanelGuide('چطور قرارداد فروش ثبت کنم؟', '/sales/pricing'),
    ).toBeUndefined();
  });
  it('does not infer a record status', () => {
    expect(
      retrieveSalesPanelGuide('چرا همین کمپین منتشر نشده؟', '/workbench'),
    ).toBe('record');
  });
  it('asks for clarification when the package workflow is unclear', () => {
    expect(
      retrieveSalesPanelGuide('قیمت پکیج رو از کجا ببینم؟', '/sales/pricing'),
    ).toBe('clarify');
  });
});
