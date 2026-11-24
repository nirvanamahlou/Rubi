import { describe, expect, it } from 'vitest';
import { assistantGuideCatalogues } from './assistant-guide-registry';
import {
  renderSystemManagementGuide,
  resolveSystemManagementGuide,
} from './system-management-guide';

const topics = assistantGuideCatalogues['system-management'].topics;

describe('System Management catalogue', () => {
  it.each(topics)(
    'routes the authored question and a follow-up for $id',
    (topic) => {
      expect(
        resolveSystemManagementGuide(topic.examples[0]!, topic.href),
      ).toMatchObject({ topic: { id: topic.id } });
      expect(
        resolveSystemManagementGuide('بعدش چی؟', '/sales', topic.id),
      ).toMatchObject({ topic: { id: topic.id }, followUp: true });
    },
  );

  it('does not use administrative guidance for a sales count or personal history', () => {
    expect(
      resolveSystemManagementGuide('تعداد قراردادهای فعال چنده؟', '/system'),
    ).toBeUndefined();
    expect(
      resolveSystemManagementGuide(
        'تاریخچه فعالیت‌های من در میزکار من',
        '/system',
      ),
    ).toBeUndefined();
  });

  it('directs record-specific questions to the authorized panel', () => {
    const intent = resolveSystemManagementGuide(
      'چه کسی دسترسی این کاربر را تغییر داد؟',
      '/workbench',
    );
    expect(intent).toMatchObject({ topic: { id: 'history' }, inspect: true });
    if (intent && 'topic' in intent) {
      expect(
        renderSystemManagementGuide(intent.topic, false, intent.inspect),
      ).toContain('در چت بررسی نشده');
    }
  });
});
