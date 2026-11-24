import { describe, expect, it, vi } from 'vitest';
import type { DocumentDetailV1 } from '@nora/contracts';
import {
  documentGuideTopics,
  readDocumentGuide,
  renderDocumentGuide,
  resolveDocumentQuestion,
} from './document-guides';

const id = '11111111-1111-4111-8111-111111111111';
const code = 'DOC-20261119-TEST';
const item = {
  id,
  archiveCode: code,
  title: 'مدرک آزمایشی',
  confidentiality: 'INTERNAL',
  archiveStatus: 'ACTIVE',
  isIncomplete: true,
  validUntil: '2026-01-01T12:00:00Z',
  owner: { displayName: 'مالک آزمایشی' },
  currentVersion: { versionNumber: 2, scanStatus: 'PENDING_SCAN' },
} as DocumentDetailV1;

describe('Documents help in Nora', () => {
  it.each(documentGuideTopics)('renders the workflow for $title', (topic) => {
    const match = resolveDocumentQuestion(topic.title, true);
    expect(match).toMatchObject({
      kind: 'guide',
      topic: { title: topic.title },
    });
    expect(renderDocumentGuide(topic, false)).toContain(topic.steps[0]);
    expect(
      resolveDocumentQuestion('بعدش چی؟', true, topic.title),
    ).toMatchObject({
      kind: 'guide',
      continuation: true,
    });
  });

  it('distinguishes document questions from contract creation and Workbench requests', () => {
    expect(
      resolveDocumentQuestion('چطور قرارداد ببندم؟', false),
    ).toBeUndefined();
    expect(
      resolveDocumentQuestion('درخواستم الان دست کیه؟', false),
    ).toBeUndefined();
    expect(
      resolveDocumentQuestion('مدرک قرارداد را کجا بارگذاری کنم؟', false),
    ).toMatchObject({ kind: 'guide' });
    expect(resolveDocumentQuestion('فایلم کجاست؟', false)).toMatchObject({
      kind: 'clarify',
    });
  });

  it.each([true, false])(
    'routes split upload wording from panel=%s',
    (onPanel) => {
      expect(
        resolveDocumentQuestion(
          'چطور فایل را در اسناد و فایل‌ها بارگذاری کنم؟',
          onPanel,
        ),
      ).toMatchObject({
        kind: 'guide',
        topic: { title: 'بارگذاری فایل' },
      });
    },
  );

  it('reads an exact code through Documents and renders verified status', async () => {
    const intent = resolveDocumentQuestion(`وضعیت سند ${code} چیست؟`, true);
    if (intent?.kind !== 'record') throw new Error('Expected record intent');
    const api = {
      list: vi
        .fn()
        .mockResolvedValue({ data: [item], meta: { totalPages: 1 } }),
      detail: vi.fn().mockResolvedValue({ data: item }),
    };
    const result = await readDocumentGuide(
      intent,
      api,
      Date.parse('2026-11-19'),
    );
    expect(api.detail).toHaveBeenCalledWith(id);
    expect(result.text).toContain('نسخهٔ جاری 2');
    expect(result.text).toContain('در انتظار اسکن');
    expect(result.text).toContain('منقضی');
    expect(result.href).toBe(`/documents?document=${id}`);
  });

  it('asks for a code instead of picking a duplicate or leaking restricted details', async () => {
    const intent = resolveDocumentQuestion(
      'وضعیت سند «مدرک آزمایشی» چیست؟',
      true,
    );
    if (intent?.kind !== 'record') throw new Error('Expected record intent');
    const api = {
      list: vi
        .fn()
        .mockResolvedValue({ data: [item, item], meta: { totalPages: 1 } }),
      detail: vi.fn().mockResolvedValue({
        data: { ...item, confidentiality: 'RESTRICTED' },
      }),
    };
    expect((await readDocumentGuide(intent, api)).text).toContain('سند دقیق');
    expect(api.detail).not.toHaveBeenCalled();
    const result = await readDocumentGuide(
      { kind: 'record', id, title: undefined, code: undefined },
      api,
    );
    expect(result.href).toBe('/documents');
    expect(result.text).not.toContain(item.owner.displayName);
  });

  it('ignores links from a different origin', () => {
    expect(
      resolveDocumentQuestion(
        `https://example.com/documents?document=${id}`,
        false,
      ),
    ).toBeUndefined();
  });
});

it('matches document download when the object precedes the action', () => {
  expect(
    resolveDocumentQuestion('چطور سند را دانلود کنم؟', true),
  ).toMatchObject({
    kind: 'guide',
    topic: { id: 'download' },
  });
});
