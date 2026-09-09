import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HrBootstrapDto, HrRecordDto } from '@rubi/contracts';
import { hrApi, HrApiError } from './hr-api';
import { HrWorkspace } from './hr-workspace';
import { recordsDataset } from './hr-live-data';
import { relatedIndexes, subsetDataset } from './hr-data-utils';
import {
  canonicalHrLocation,
  employeeGroups,
  hrGroups,
  resolveHrGroup,
} from './hr-navigation';
import { prepareHrCommand } from './hr-commands';
import { parseSavedHrFilter } from './hr-filters';
import { buildSearchablePdf, pdfVisualText } from './hr-searchable-pdf';
import { buildLiveOrganizationNodes } from './hr-organization';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
const record = (id: string, parentId: string | null = null): HrRecordDto => ({
  id,
  code: `HR-${id}`,
  branchId: 'branch1',
  section: 'recruitment',
  tab: 'interviews',
  employeeId: null,
  parentId,
  columns: ['متقاضی', 'زمان'],
  values: ['نام مشابه', '2026-09-08'],
  version: 2,
  status: 'پیش‌نویس',
  effectiveAt: null,
  appliedAt: null,
  deletedAt: null,
  createdAt: '2026-09-08T00:00:00Z',
  updatedAt: '2026-09-08T00:00:00Z',
  data: {},
});

describe('Live HR boundaries and consolidated workflows', () => {
  it('never exposes demo employees or preview data before authentication/bootstrap completes', () => {
    const html = renderToStaticMarkup(<HrWorkspace sectionId="employees" />);
    expect(html).toContain('در حال دریافت منابع انسانی');
    expect(html).not.toContain('همکار نمایشی');
    expect(html).not.toContain('data-hr-mode="preview"');
  });
  it('keeps legacy URLs in a single consolidated surface', () => {
    expect(canonicalHrLocation('finance', 'batch')).toEqual({
      section: 'payroll',
      tab: 'batch',
    });
    expect(canonicalHrLocation('contracts', 'termination')).toEqual({
      section: 'lifecycle',
      tab: 'termination',
    });
    expect(canonicalHrLocation('fleet', 'vehicles')).toEqual({
      section: 'assets',
      tab: 'vehicles',
    });
    expect(hrGroups.time?.map((group) => group.id)).toEqual([
      'work',
      'shifts',
      'leaves',
      'settings',
    ]);
    expect(resolveHrGroup(hrGroups.lifecycle!, 'transfer').id).toBe('changes');
    expect(employeeGroups).toHaveLength(8);
  });
  it('does not cross-link candidates with matching display names', () => {
    const parent = {
      columns: ['شناسه', 'متقاضی'],
      rows: [['A', 'نام مشابه']],
      recordIds: ['candidate-A'],
      totalLabel: '',
    };
    const data = {
      columns: ['شناسه', 'متقاضی'],
      rows: [
        ['I1', 'نام مشابه'],
        ['I2', 'نام مشابه'],
      ],
      recordIds: ['interview1', 'interview2'],
      parentIds: ['candidate-A', 'candidate-B'],
      versions: [1, 5],
      totalLabel: '',
    };
    const indexes = relatedIndexes(parent, 0, data);
    expect(indexes).toEqual([0]);
    expect(subsetDataset(data, indexes).recordIds).toEqual(['interview1']);
    expect(subsetDataset(data, indexes).versions).toEqual([1]);
  });
  it('keeps UUID/version metadata aligned with visible scoped datasets', () => {
    const first = record('a', 'candidate-a');
    const second = { ...record('b'), section: 'contracts', tab: 'active' };
    const dataset = recordsDataset('recruitment', 'interviews', [
      first,
      second,
    ]);
    expect(dataset.recordIds).toEqual(['a']);
    expect(dataset.versions).toEqual([2]);
    expect(dataset.parentIds).toEqual(['candidate-a']);
  });
  it('uses the same ISO dates and currency command preparation for forms and spreadsheet rows', () => {
    const data = { employees: [], branches: [] } as unknown as HrBootstrapDto;
    const input = {
      section: 'time',
      tab: 'leave',
      employeeId: 'employee-a',
      values: ['همکار', 'استحقاقی', '۱۴۰۵/۰۶/۱۷', '۱۴۰۵/۰۶/۱۸', '۲'],
      status: 'پیش‌نویس',
    };
    const result = prepareHrCommand(input, data);
    expect(result.values.join(' ')).not.toContain('۱۴۰۵/');
    expect(result.data?.startsAt).toMatch(/^2026-09-\d{2}T00:00:00.000Z$/);
    expect(result.data?.endsAt).toMatch(/^2026-09-\d{2}T23:59:59.999Z$/);
    expect(() =>
      prepareHrCommand(
        {
          ...input,
          values: input.values.map((value, index) =>
            index === 0 ? 'data:text/html,bad' : value,
          ),
        },
        data,
      ),
    ).toThrow('پیوست');
  });
  it('normalizes attendance corrections from Tehran clocks to UTC', () => {
    const result = prepareHrCommand(
      {
        section: 'time',
        tab: 'corrections',
        employeeId: 'a',
        values: ['همکار', '2026-09-08', '', '08:00 تا 17:00', 'اصلاح تردد', ''],
        status: 'پیش‌نویس',
      },
      { employees: [], branches: [] } as unknown as HrBootstrapDto,
    );
    expect(result.data?.startsAt).toBe('2026-09-08T04:30:00.000Z');
    expect(result.data?.endsAt).toBe('2026-09-08T13:30:00.000Z');
  });
  it('rejects filters for a company no longer in the authorized scope', () => {
    expect(
      parseSavedHrFilter(
        JSON.stringify({
          status: 'فعال',
          branchId: 'outside',
          from: '',
          to: '',
          expiry: '',
        }),
        ['branch1'],
      ),
    ).toBeNull();
    expect(parseSavedHrFilter('{bad}', [])).toBeNull();
  });
  it('renders chart edges from persisted unit parent IDs and updates employee counts', () => {
    const root = {
      ...record('root'),
      section: 'organization',
      tab: 'units',
      parentId: null,
      columns: ['نام واحد', 'مدیر', 'تاریخ اثر'],
      values: ['فروش', 'مدیر', '2026-09-08'],
    };
    const child = {
      ...root,
      id: 'child',
      parentId: 'root',
      values: ['فروش آنلاین', 'مدیر', '2026-09-08'],
    };
    const nodes = buildLiveOrganizationNodes(
      [root, child],
      [{ id: 'branch1', name: 'نیایش سیر' }],
      [
        {
          id: 'e1',
          name: 'همکار',
          branchId: 'branch1',
          unit: 'فروش آنلاین',
          position: 'کارشناس',
        },
      ],
    );
    expect(nodes.find((node) => node.id === 'child')?.parentId).toBe('root');
    expect(nodes.find((node) => node.id === 'child')?.positionCapacity).toBe(1);
  });
  it('sends idempotency and optimistic version tokens with authenticated commands', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/api/v1');
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(JSON.stringify(record('a')), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetcher);
    await hrApi.records.create(
      { section: 'time', tab: 'leave', values: [] },
      'same-command',
    );
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      credentials: 'include',
      headers: { 'Idempotency-Key': 'same-command' },
    });
    await hrApi.records.update('a', { version: 4, values: ['next'] });
    expect(JSON.parse(fetcher.mock.calls[1]?.[1]?.body as string).version).toBe(
      4,
    );
  });
  it('surfaces conflict rather than pretending a stale edit was saved', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/api/v1');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 409 })),
    );
    await expect(
      hrApi.records.update('a', { version: 1 }),
    ).rejects.toBeInstanceOf(HrApiError);
  });
  it('includes Unicode text and valid xref offsets in exported Persian PDFs', () => {
    expect(pdfVisualText('جهان باستان HR-123')).toBe('ناتساب ناهج HR-123');
    const pdf = buildSearchablePdf([
      {
        image: new Uint8Array([255, 216, 255, 217]),
        width: 1240,
        height: 1754,
        lines: [
          { text: 'قرارداد نیایش سیر HR-1001', x: 1100, y: 130, size: 30 },
        ],
      },
    ]);
    const text = new TextDecoder().decode(pdf);
    expect(text).toContain('/ToUnicode');
    expect(text).toContain('/ActualText <FEFF');
    const offset = Number(text.match(/startxref\n(\d+)/)?.[1]);
    expect(new TextDecoder().decode(pdf.slice(offset, offset + 4))).toBe(
      'xref',
    );
  });
  it('does not import the legacy session UI into the routed workspace', () => {
    const source = readFileSync(
      new URL('./hr-workspace.tsx', import.meta.url),
      'utf8',
    );
    expect(source).not.toContain('hr-legacy-preview');
    expect(source).not.toContain('sessionStorage');
  });
});
