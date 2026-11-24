import { afterEach, describe, expect, it, vi } from 'vitest';
import catalog from './correspondence-guide.generated.json';
import {
  readCorrespondenceStatus,
  resolveCorrespondenceGuide,
} from './correspondence-guide';

const number = 'ns/1405/09/03/000001';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('correspondence guide', () => {
  it.each(catalog.filter(({ id }) => id !== 'overview'))(
    'routes the example for $id',
    ({ id, href, examples }) => {
      expect(resolveCorrespondenceGuide(examples[0]!, href)).toMatchObject({
        kind: 'guide',
        topic: { id },
      });
    },
  );

  it('clarifies letter type and continues a specific guide across pages', () => {
    expect(
      resolveCorrespondenceGuide('نامه را از کجا ثبت کنم؟', '/correspondence'),
    ).toMatchObject({ kind: 'clarify' });
    expect(
      resolveCorrespondenceGuide('بعدش چی؟', '/workbench', 'internal-send'),
    ).toMatchObject({ kind: 'guide', followUp: true });
    expect(
      resolveCorrespondenceGuide(
        'حکم کارگزینی را از کجا ببینم؟',
        '/correspondence',
      ),
    ).toBeUndefined();
    expect(
      resolveCorrespondenceGuide(
        'وضعیت نامه داخلی NS/۱۴۰۵/۰۹/۰۳/۰۰۰۰۰۱ چیست؟',
        '/hr',
      ),
    ).toMatchObject({ kind: 'read', number });
  });

  it('returns only delivery status and leaves read state untouched', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '/api/v1');
    const fetcher = vi.fn().mockResolvedValueOnce(
      Response.json({
        total: 1,
        items: [
          {
            letter: { number: 'NS/1405/09/03/000001', text: 'sensitive' },
            delivery: {
              status: 'APPROVED',
              readAt: null,
              description: 'private',
            },
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetcher);
    const result = await readCorrespondenceStatus(
      number,
      new AbortController().signal,
    );
    expect(result).toContain('خوانده‌نشده');
    expect(result).toContain('تأیید');
    expect(result).not.toMatch(/sensitive|private/);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('/correspondence/v1/internal?search='),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('distinguishes denial, incomplete lookup and no visible match', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '/api/v1');
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({}, { status: 403 }))
      .mockResolvedValueOnce(Response.json({ total: 26, items: [] }))
      .mockResolvedValueOnce(Response.json({ total: 0, items: [] }));
    vi.stubGlobal('fetch', fetcher);
    const signal = new AbortController().signal;
    expect(await readCorrespondenceStatus(number, signal)).toContain('دسترسی');
    expect(await readCorrespondenceStatus(number, signal)).toContain(
      'تأیید نشد',
    );
    expect(await readCorrespondenceStatus(number, signal)).toContain(
      'پیدا نشد',
    );
  });
});
