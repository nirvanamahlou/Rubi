import { isValidElement, type ReactNode, type ReactElement } from 'react';
import type * as ReactModule from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarketingPromotionsPanel } from './marketing-promotions-panel';
import { promotionDraft } from '../model/promotions';
import { canonicalTestTree } from '@/i18n/test-tree';
import { OfferAudienceTargetSelector } from './offer-audience-target-selector';

const state = vi.hoisted(() => ({
  values: [] as unknown[],
  index: 0,
  refs: [] as { current: unknown }[],
  refIndex: 0,
  save: vi.fn(),
  remove: vi.fn(),
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
  useRef: (initial: unknown) => {
    const index = state.refIndex++;
    return (state.refs[index] ??= { current: initial });
  },
  useEffect: vi.fn(),
  useCallback: (callback: unknown) => callback,
}));
vi.mock('../api/records-client', () => ({
  MarketingApiError: class extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message);
    }
  },
  marketingApi: {
    saveAsset: state.save,
    deleteAsset: state.remove,
    access: vi.fn(),
    assets: vi.fn(),
  },
}));
import { MarketingApiError } from '../api/records-client';
function nodes(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  node = canonicalTestTree(node);
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...nodes(node.props.children as ReactNode)];
}
const close = vi.fn();
const notice = vi.fn();
function render(tab = 'discounts') {
  state.index = 0;
  state.refIndex = 0;
  return nodes(
    MarketingPromotionsPanel({
      tab,
      adding: true,
      onAdd: vi.fn(),
      onClose: close,
      onNotice: notice,
    }),
  );
}
function submit(tab = 'discounts') {
  (
    render(tab).find((node) => node.type === 'form')!.props.onSubmit as (
      e: unknown,
    ) => void
  )({ preventDefault() {} });
}
beforeEach(() => {
  vi.clearAllMocks();
  state.values = [];
  state.refs = [];
  render();
  state.values[1] = {
    branchIds: ['branch-1'],
    permissions: ['marketing.read', 'marketing.offer.manage'],
  };
  state.values[2] = false;
  state.values[10] = {
    ...promotionDraft(),
    name: 'پیشنهاد واقعی',
    code: 'TEST-10',
    startsAt: '2026-10-01T00:00:00Z',
    endsAt: '2026-11-01T00:00:00Z',
  };
  state.values[13] = 'branch-1';
  state.save.mockImplementation(async (input) => ({
    data: {
      ...input,
      id: 'saved-1',
      branchId: 'branch-1',
      version: 1,
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
      contractVersion: 'marketing.records.v1',
      externalExecutionStatus: 'UNAVAILABLE',
    },
  }));
});
describe('durable promotion forms', () => {
  it.each(['discounts', 'specials'])(
    'saves %s to the API before closing and adopts the persisted record',
    async (tab) => {
      submit(tab);
      await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
      expect(state.save).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: tab === 'specials' ? 'OFFER' : 'COUPON',
          name: 'پیشنهاد واقعی',
          targetCustomerId: null,
          targetAgencyId: null,
        }),
        expect.objectContaining({
          branchId: 'branch-1',
          key: expect.any(String),
        }),
      );
      expect(state.values[0]).toEqual([
        expect.objectContaining({ id: 'saved-1', name: 'پیشنهاد واقعی' }),
      ]);
      expect(notice).toHaveBeenCalledWith('پیشنهاد ذخیره شد.');
    },
  );
  it('retains corrective input and errors instead of showing a false success', async () => {
    state.save.mockRejectedValueOnce(
      new MarketingApiError('خطای اعتبارسنجی', 400),
    );
    submit();
    await vi.waitFor(() => expect(state.values[14]).toBe('خطای اعتبارسنجی'));
    expect(close).not.toHaveBeenCalled();
    expect(notice).not.toHaveBeenCalled();
    expect(state.values[10]).toMatchObject({
      name: 'پیشنهاد واقعی',
      code: 'TEST-10',
    });
    expect(state.values[0]).toEqual([]);
    expect(state.values[16]).toBe(false);
  });
  it('reuses the same request key after an unknown network result and guards double submit', async () => {
    state.save.mockRejectedValueOnce(new Error('Network unavailable'));
    submit();
    submit();
    await vi.waitFor(() => expect(state.values[16]).toBe(true));
    expect(state.save).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    submit();
    await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(state.save.mock.calls[1]![1].key).toBe(
      state.save.mock.calls[0]![1].key,
    );
  });
  it.each(['customer', 'agency'] as const)(
    'persists only the canonical %s ID, not names or contact data',
    async (kind) => {
      const selector = render().find(
        (node) => node.type === OfferAudienceTargetSelector,
      )!;
      (selector.props.onKindChange as (kind: string) => void)(kind);
      (selector.props.onChange as (target: unknown) => void)({
        kind,
        id: 'target-1',
        label: 'مخاطب مرجع',
      });
      submit();
      await vi.waitFor(() => expect(close).toHaveBeenCalled());
      const input = state.save.mock.calls[0]![0];
      expect(
        input[kind === 'customer' ? 'targetCustomerId' : 'targetAgencyId'],
      ).toBe('target-1');
      expect(JSON.stringify(input)).not.toContain('مخاطب مرجع');
    },
  );
  it('blocks missing explicit audience and invalid dates before sending any request', () => {
    state.values[11] = 'customer';
    submit();
    expect(state.values[14]).toBe('مخاطب هدف را انتخاب کنید.');
    expect(state.save).not.toHaveBeenCalled();
    state.values[11] = 'none';
    state.values[10] = {
      ...(state.values[10] as object),
      endsAt: '2026-01-01T00:00:00Z',
    };
    submit();
    expect(state.values[14]).toBe('نام و بازه اعتبار پیشنهاد را کامل کنید.');
    expect(state.save).not.toHaveBeenCalled();
  });
  it('does not close or emit success when a 2xx result is malformed', async () => {
    state.save.mockResolvedValueOnce({ data: {} });
    submit();
    await vi.waitFor(() => expect(state.values[16]).toBe(true));
    expect(close).not.toHaveBeenCalled();
    expect(notice).not.toHaveBeenCalled();
    expect(state.values[0]).toEqual([]);
  });
});
