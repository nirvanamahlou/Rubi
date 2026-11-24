import { describe, expect, it } from 'vitest';
import { assistantGuideCatalogues } from './assistant-guide-registry';
import { renderHrGuide, resolveHrGuide } from './hr-guide';

describe('HR guide', () => {
  it.each(assistantGuideCatalogues['human-resources'].topics)(
    'routes a representative question for $id',
    ({ id, examples }) => {
      expect(resolveHrGuide(examples[0]!, '/hr')).toMatchObject({
        topic: { id },
      });
    },
  );

  it('continues the previous topic after a navigation', () => {
    const result = resolveHrGuide('بعدش چی؟', '/system', 'time');
    if (!result || !('topic' in result)) throw new Error('Expected HR topic');
    expect(renderHrGuide(result.topic, result.followUp)).toContain('نیمه‌شب');
  });

  it('does not handle an explicitly foreign panel or personal status read', () => {
    expect(resolveHrGuide('چطور قرارداد فروش ثبت کنم؟', '/hr')).toBeUndefined();
    expect(resolveHrGuide('مرخصی من در چه وضعیتی است؟', '/hr')).toBeUndefined();
    expect(resolveHrGuide('حقوق من چقدر است؟', '/hr')).toHaveProperty(
      'clarification',
    );
  });
});
