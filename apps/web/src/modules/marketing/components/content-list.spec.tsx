import type { MarketingAssetViewV1, DocumentListItemV1 } from '@nora/contracts';
import { isValidElement, type ReactNode, type ReactElement } from 'react';
import type * as ReactModule from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DurableContentPanel } from './marketing-durable-panels';
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
