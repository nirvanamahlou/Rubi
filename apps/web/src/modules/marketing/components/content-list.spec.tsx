import type { MarketingAssetViewV1, DocumentListItemV1 } from '@nora/contracts';
import { isValidElement, type ReactNode, type ReactElement } from 'react';
import type * as ReactModule from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DurableContentPanel,
  DurableIntakesPanel,
  DurableSegmentsPanel,
} from './marketing-durable-panels';
import { AudienceToolbar } from './audience-toolbar';
import {
  audienceMatches,
  audienceRuleLabels,
  audienceSourceLabel,
  audienceStatusLabels,
} from '../model/audience-presentation';
import { MarketingContentLibrary } from './marketing-content-library';

const state = vi.hoisted(() => ({
  values: [] as unknown[],
  index: 0,
  save: vi.fn(),
  assets: vi.fn(),
  campaigns: vi.fn(),
  access: vi.fn(),
  remove: vi.fn(),
  detail: vi.fn(),
  update: vi.fn(),
  archive: vi.fn(),
  push: vi.fn(),
  intakes: vi.fn(),
  createIntake: vi.fn(),
  scoreIntake: vi.fn(),
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState: (initial: unknown) => {
    const index = state.index++;
    if (!(index in state.values))
      state.values[index] = typeof initial === 'function' ? initial() : initial;
    return [
      state.values[index],
      (next: unknown) => {
        state.values[index] =
          typeof next === 'function' ? next(state.values[index]) : next;
      },
    ];
  },
  useEffect: vi.fn(),
  useCallback: (callback: unknown) => callback,
}));
vi.mock('../api/records-client', () => ({
  marketingApi: {
    saveAsset: state.save,
    assets: state.assets,
    campaigns: state.campaigns,
    access: state.access,
    deleteAsset: state.remove,
    intakes: state.intakes,
    createIntake: state.createIntake,
    scoreIntake: state.scoreIntake,
  },
}));
vi.mock('@/modules/documents/api/client', () => ({
  documentsApi: {
    detail: state.detail,
    update: state.update,
    archive: state.archive,
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: state.push }) }));
function nodes(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...nodes(node.props.children as ReactNode)];
}
const asset: MarketingAssetViewV1 = {
  contractVersion: 'marketing.records.v1',
  branchId: 'branch-1',
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
  externalExecutionStatus: 'UNAVAILABLE',
  id: 'form-1',
  name: 'فرم سفر',
  kind: 'FORM',
  status: 'ACTIVE',
  version: 7,
  campaignId: 'campaign-1',
  relatedAssetId: 'landing-1',
  payload: {
    type: 'SURVEY',
    landingPage: 'تهران',
    completionRate: 50,
    responseCount: 20,
  },
};
const notice = vi.fn();
function content() {
  state.index = 0;
  return nodes(DurableContentPanel({ tab: 'forms', onNotice: notice }));
}
function library() {
  state.index = 0;
  return nodes(
    MarketingContentLibrary({
      revision: 0,
      adding: false,
      onAdd: vi.fn(),
      onNotice: notice,
    }),
  );
}
const find = (items: ReturnType<typeof nodes>, key: string, value: unknown) =>
  items.findLast((item) => item.props[key] === value)!;
beforeEach(() => {
  vi.clearAllMocks();
  state.values = [
    { branchIds: ['branch-1'] },
    [{ id: 'campaign-1', name: 'کمپین تهران' }],
    [asset],
    false,
    '',
    null,
    false,
  ];
  state.access.mockResolvedValue({ branchIds: ['branch-1'] });
  state.assets.mockResolvedValue({ data: [asset] });
  state.campaigns.mockResolvedValue({ data: [] });
  state.save.mockResolvedValue({ data: asset });
  state.remove.mockResolvedValue({});
});

function intake(mode: 'leads' | 'scoring' = 'leads') {
  state.index = 0;
  return nodes(DurableIntakesPanel({ mode, onNotice: notice }));
}
function seedIntakes() {
  state.values = [
    { branchIds: ['branch-1'], userId: 'actor-secret-id' },
    [{ id: 'campaign-1', name: 'کمپین تهران' }],
    [],
    false,
    '',
    [
      {
        id: 'intake-1',
        maskedPhone: '0912***1234',
        sourceCategory: 'WEBSITE',
        campaignId: 'campaign-1',
        status: 'QUALIFIED',
        score: 40,
        version: 9,
        scoreRuleIds: ['PHONE_VALID'],
        assigneeUserId: 'actor-secret-id',
      },
    ],
    '',
    '',
    'WEBSITE',
    'none',
    'NEW',
    '',
    ['PHONE_VALID'],
    null,
    false,
    '',
    'all',
    'all',
    false,
    '',
    false,
  ];
  state.intakes.mockResolvedValue({ data: [] });
  state.createIntake.mockResolvedValue({});
  state.scoreIntake.mockResolvedValue({});
}
describe('audience presentation and canonical mutations', () => {
  it('uses Persian labels and normalized Persian search without exposing raw source codes', () => {
    expect(audienceSourceLabel('WEBSITE')).toBe('وب‌سایت');
    expect(audienceSourceLabel('EXTERNAL_UNKNOWN')).toBe('منبع دیگر');
    expect(audienceSourceLabel('نمایشگاه')).toBe('نمایشگاه');
    expect(audienceStatusLabels.QUALIFIED).toBe('واجد شرایط');
    expect(audienceRuleLabels.PHONE_VALID).toBe('شماره تماس معتبر');
    expect(audienceMatches('كمپين', ['کمپین تهران'])).toBe(true);
    expect(audienceMatches('ناشناخته', ['کمپین تهران'])).toBe(false);
  });
  it('renders RTL masked-intake tables and readable scoring rules', () => {
    seedIntakes();
    const tree = intake('scoring');
    expect(tree[0]!.props.dir).toBe('rtl');
    expect(tree.some((node) => node.type === 'table')).toBe(true);
    expect(tree.some((node) => node.props.children === 'وب‌سایت')).toBe(true);
    expect(tree.some((node) => node.props.children === 'واجد شرایط')).toBe(
      true,
    );
    expect(tree.some((node) => node.props.children === '0912***1234')).toBe(
      true,
    );
    expect(tree.some((node) => node.props.children === 'actor-secret-id')).toBe(
      false,
    );
    expect(
      tree.some(
        (node) =>
          node.type === 'label' &&
          (node.props.children as unknown[]).includes('شماره تماس معتبر'),
      ),
    ).toBe(true);
  });
  it('filters intakes by status and source through the shared toolbar', () => {
    seedIntakes();
    const tree = intake();
    const toolbar = tree.find((node) => node.type === AudienceToolbar)!;
    (toolbar.props.onStatus as (value: string) => void)('LOST');
    expect(intake().filter((node) => node.type === 'td')).toHaveLength(0);
    (toolbar.props.onStatus as (value: string) => void)('all');
    (toolbar.props.onSource as (value: string) => void)('WEBSITE');
    expect(intake().filter((node) => node.type === 'td')).toHaveLength(6);
    (toolbar.props.onSource as (value: string) => void)('PHONE');
    expect(intake().filter((node) => node.type === 'td')).toHaveLength(0);
  });
  it('creates from Persian controls while retaining canonical owner, status and source', async () => {
    seedIntakes();
    let tree = intake();
    const toolbar = tree.find((node) => node.type === AudienceToolbar)!;
    (toolbar.props.onAdd as () => void)();
    tree = intake();
    (
      find(tree, 'id', 'intake-phone').props.onChange as (
        event: unknown,
      ) => void
    )({ target: { value: '09123456789' } });
    tree = intake();
    await (
      find(tree, 'aria-label', 'ذخیره سرنخ جدید').props
        .onClick as () => Promise<void>
    )();
    expect(state.createIntake).toHaveBeenCalledWith(
      {
        phone: '09123456789',
        sourceCategory: 'WEBSITE',
        campaignId: null,
        status: 'NEW',
        assigneeUserId: 'actor-secret-id',
        lastFollowUpAt: null,
      },
      'branch-1',
    );
    expect(state.values[14]).toBe(false);
  });
  it('scores with original rule IDs and displayed CAS version', async () => {
    seedIntakes();
    await (
      find(intake('scoring'), 'aria-label', 'محاسبه امتیاز 0912***1234').props
        .onClick as () => Promise<void>
    )();
    expect(state.scoreIntake).toHaveBeenCalledWith(
      'intake-1',
      ['PHONE_VALID'],
      9,
    );
  });
  it('renders at most 25 intake rows and navigates the remaining records', () => {
    seedIntakes();
    const item = (state.values[5] as Record<string, unknown>[])[0]!;
    state.values[5] = Array.from({ length: 26 }, (_, index) => ({
      ...item,
      id: `intake-${index}`,
      maskedPhone: `شماره ${index}`,
    }));
    let tree = intake();
    expect(tree.filter((node) => node.type === 'td')).toHaveLength(150);
    (
      find(tree, 'aria-label', 'صفحه بعد سرنخ‌ها').props.onClick as () => void
    )();
    tree = intake();
    expect(tree.filter((node) => node.type === 'td')).toHaveLength(6);
    expect(tree.some((node) => node.props.children === 'شماره 25')).toBe(true);
  });
  it('keeps the intake dialog open with server errors and allows correction', async () => {
    seedIntakes();
    state.values[7] = '09123456789';
    state.values[14] = true;
    state.createIntake.mockRejectedValueOnce(new Error('ثبت مجاز نیست'));
    await (
      find(intake(), 'aria-label', 'ذخیره سرنخ جدید').props
        .onClick as () => Promise<void>
    )();
    expect(state.values[14]).toBe(true);
    expect(state.values[19]).toBe('ثبت مجاز نیست');
    expect(state.values[18]).toBe(false);
  });
  it('retains segment status, additional rules and CAS on editor save', async () => {
    const segment = {
      ...asset,
      kind: 'SEGMENT',
      status: 'PAUSED',
      payload: {
        rules: [{ expression: 'شرط نخست' }, { expression: 'شرط دوم' }],
      },
    };
    state.values = [
      { branchIds: ['branch-1'] },
      [],
      [segment],
      false,
      '',
      'گروه سفر',
      'شرط ویرایش‌شده',
      segment,
      false,
      false,
      true,
      '',
      'all',
      '',
    ];
    state.index = 0;
    const tree = nodes(DurableSegmentsPanel({ onNotice: notice }));
    await (
      tree.find((node) => node.type === 'form')!.props.onSubmit as (
        event: unknown,
      ) => void
    )({ preventDefault() {} });
    await vi.waitFor(() => expect(state.save).toHaveBeenCalled());
    expect(state.save.mock.calls[0]![0]).toMatchObject({
      kind: 'SEGMENT',
      status: 'PAUSED',
      expectedVersion: 7,
      payload: {
        rules: [{ expression: 'شرط ویرایش‌شده' }, { expression: 'شرط دوم' }],
      },
    });
  });
});
describe('content list actions', () => {
  it('starts list-first with Persian labels, RTL and an icon add entry', () => {
    const tree = content();
    expect(tree[0]!.props.dir).toBe('rtl');
    expect(tree.some((node) => node.type === 'table')).toBe(true);
    expect(find(tree, 'aria-label', 'افزودن محتوا').props.size).toBe('icon');
    expect(tree.some((node) => node.props.children === 'نظرسنجی')).toBe(true);
    expect(tree.some((node) => node.props.children === 'فعال')).toBe(true);
    expect(find(tree, 'id', 'content-list-search').props.type).toBe('search');
  });
  it('filters by campaign and normalizes Persian characters', () => {
    let tree = content();
    (
      find(tree, 'id', 'content-list-search').props.onChange as (
        ...args: unknown[]
      ) => unknown
    )({
      target: { value: 'كمپين تهران' },
    });
    tree = content();
    expect(tree.filter((node) => node.type === 'td')).not.toHaveLength(0);
    (
      find(tree, 'id', 'content-list-search').props.onChange as (
        ...args: unknown[]
      ) => unknown
    )({
      target: { value: 'ناشناخته' },
    });
    expect(content().filter((node) => node.type === 'td')).toHaveLength(0);
  });
  it('opens add and preserves canonical values/version while editing and saving', async () => {
    let tree = content();
    (
      find(tree, 'aria-label', 'افزودن محتوا').props.onClick as (
        ...args: unknown[]
      ) => unknown
    )();
    expect(state.values[8]).toBe(true);
    const actions = tree.find((node) => node.props.item === asset)!;
    (actions.props.onEdit as (...args: unknown[]) => unknown)();
    tree = content();
    expect(find(tree, 'id', 'content-record-name').props.value).toBe('فرم سفر');
    await (
      tree.find((node) => node.type === 'form')!.props.onSubmit as (
        ...args: unknown[]
      ) => unknown
    )({ preventDefault() {} });
    await vi.waitFor(() => expect(state.save).toHaveBeenCalled());
    expect(state.save.mock.calls[0]![0]).toMatchObject({
      kind: 'FORM',
      expectedVersion: 7,
      campaignId: 'campaign-1',
      relatedAssetId: 'landing-1',
      payload: { ...asset.payload, completionRate: '50', responseCount: '20' },
    });
    expect(state.save.mock.calls[0]![1]).toEqual({
      id: 'form-1',
      branchId: 'branch-1',
    });
  });
  it('does not delete without confirmation and uses the displayed version on approval', async () => {
    vi.stubGlobal('window', { confirm: vi.fn().mockReturnValue(false) });
    const actions = content().find((node) => node.props.item === asset)!;
    await (actions.props.onDelete as (...args: unknown[]) => unknown)();
    expect(state.remove).not.toHaveBeenCalled();
    window.confirm = vi.fn().mockReturnValue(true);
    await (actions.props.onDelete as (...args: unknown[]) => unknown)();
    expect(state.remove).toHaveBeenCalledWith('form-1', 7);
    vi.unstubAllGlobals();
  });
});

const document = {
  id: 'doc-1',
  title: 'بروشور',
  version: 3,
  type: { name: 'محتوا' },
  category: { id: 'category-1', name: 'برند' },
  owner: { id: 'owner-1', displayName: 'مالک' },
  description: 'توضیحات',
  confidentiality: 'INTERNAL',
  validUntil: null,
  isIncomplete: false,
  capabilities: { editMetadata: true, archive: true },
} as DocumentListItemV1;
function seedLibrary(item = document) {
  state.values = ['', 1, 1, [item], false, '', 0, null, '', false, ''];
}
describe('real Documents library', () => {
  it('edits metadata with CAS and retains all other fields', async () => {
    seedLibrary();
    state.detail.mockResolvedValue({ data: document });
    state.update.mockResolvedValue({});
    let tree = library();
    (
      find(tree, 'aria-label', 'ویرایش بروشور').props.onClick as (
        ...args: unknown[]
      ) => unknown
    )();
    tree = library();
    (
      find(tree, 'id', 'library-record-value').props.onChange as (
        ...args: unknown[]
      ) => unknown
    )({
      target: { value: 'بروشور جدید' },
    });
    tree = library();
    await (
      tree.find((node) => node.type === 'form')!.props.onSubmit as (
        ...args: unknown[]
      ) => unknown
    )({ preventDefault() {} });
    await vi.waitFor(() => expect(state.update).toHaveBeenCalled());
    expect(state.update).toHaveBeenCalledWith('doc-1', {
      title: 'بروشور جدید',
      description: 'توضیحات',
      categoryId: 'category-1',
      ownerUserId: 'owner-1',
      confidentiality: 'INTERNAL',
      isIncomplete: false,
      version: 3,
    });
  });
  it('archives with a reason/version instead of permanently deleting', async () => {
    seedLibrary();
    state.archive.mockResolvedValue({});
    let tree = library();
    (
      find(tree, 'aria-label', 'حذف بروشور').props.onClick as (
        ...args: unknown[]
      ) => unknown
    )();
    tree = library();
    (
      find(tree, 'id', 'library-record-value').props.onChange as (
        ...args: unknown[]
      ) => unknown
    )({
      target: { value: 'قدیمی شده' },
    });
    tree = library();
    await (
      tree.find((node) => node.type === 'form')!.props.onSubmit as (
        ...args: unknown[]
      ) => unknown
    )({ preventDefault() {} });
    await vi.waitFor(() =>
      expect(state.archive).toHaveBeenCalledWith('doc-1', {
        reason: 'قدیمی شده',
        version: 3,
      }),
    );
  });
  it('routes protected files to owner access verification without mutating', () => {
    seedLibrary({ ...document, requiresConfidentialAccessCode: true });
    (
      find(library(), 'aria-label', 'ویرایش بروشور').props.onClick as (
        ...args: unknown[]
      ) => unknown
    )();
    expect(state.push).toHaveBeenCalledWith('/documents?document=doc-1');
    expect(state.update).not.toHaveBeenCalled();
    expect(state.values[7]).toBeNull();
  });
  it('blocks stale-version metadata edits and keeps the form error', async () => {
    seedLibrary();
    state.detail.mockResolvedValue({ data: { ...document, version: 4 } });
    (
      find(library(), 'aria-label', 'ویرایش بروشور').props.onClick as (
        ...args: unknown[]
      ) => unknown
    )();
    await (
      library().find((node) => node.type === 'form')!.props.onSubmit as (
        ...args: unknown[]
      ) => unknown
    )({ preventDefault() {} });
    await vi.waitFor(() => expect(state.values[10]).toContain('تغییر کرده'));
    expect(state.update).not.toHaveBeenCalled();
  });
});
