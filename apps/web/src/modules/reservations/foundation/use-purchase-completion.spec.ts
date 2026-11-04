import { afterEach, expect, it, vi } from 'vitest';
const harness = vi.hoisted(() => ({
  state: undefined as unknown,
  effect: undefined as (() => (() => void) | undefined) | undefined,
  request: vi.fn(),
}));
vi.mock('react', () => ({
  useState: () => [
    harness.state,
    (value: unknown) => {
      harness.state = value;
    },
  ],
  useEffect: (effect: () => (() => void) | undefined) => {
    harness.effect = effect;
  },
}));
vi.mock('../components/travel-workflow-form', () => ({
  travelRequest: harness.request,
}));
import {
  usePurchaseCompletion,
  usePurchaseRegistration,
} from './use-purchase-completion';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  harness.state = undefined;
  harness.request.mockReset();
});
it('uses persisted registration independently of full coverage and form status', async () => {
  const target = new EventTarget();
  vi.stubGlobal('window', target);
  harness.request.mockResolvedValueOnce({
    data: { complete: false, registered: true },
  });
  expect(usePurchaseRegistration('no-form', 1)).toBe(false);
  const cleanup = harness.effect?.();
  await Promise.resolve();
  expect(usePurchaseRegistration('no-form', 1)).toBe(true);
  expect(usePurchaseCompletion('no-form', 1)).toBe(false);
  expect(usePurchaseRegistration('different', 1)).toBe(false);
  expect(usePurchaseRegistration('no-form', 2)).toBe(false);
  harness.request.mockResolvedValueOnce({ data: { complete: true } });
  target.dispatchEvent(new Event('reservation-workflow-changed'));
  await Promise.resolve();
  expect(usePurchaseRegistration('no-form', 1)).toBe(false);
  cleanup?.();
});
it('refreshes on save, rejects stale responses and never carries green to another contract or revision', async () => {
  vi.useFakeTimers();
  const target = new EventTarget();
  vi.stubGlobal('window', target);
  let oldResolve: (value: unknown) => void = () => undefined;
  harness.request.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        oldResolve = resolve;
      }),
  );
  expect(usePurchaseCompletion('first', 1)).toBe(false);
  const cleanup = harness.effect?.();
  harness.request.mockResolvedValueOnce({ data: { complete: true } });
  target.dispatchEvent(new Event('reservation-workflow-changed'));
  await Promise.resolve();
  expect(usePurchaseCompletion('first', 1)).toBe(true);
  oldResolve({ data: { complete: false } });
  await Promise.resolve();
  expect(usePurchaseCompletion('first', 1)).toBe(true);
  expect(usePurchaseCompletion('second', 1)).toBe(false);
  expect(usePurchaseCompletion('first', 2)).toBe(false);
  harness.request.mockRejectedValueOnce(new Error('offline'));
  target.dispatchEvent(new Event('focus'));
  await Promise.resolve();
  await Promise.resolve();
  expect(usePurchaseCompletion('first', 1)).toBe(false);
  cleanup?.();
  harness.request.mockClear();
  target.dispatchEvent(new Event('reservation-workflow-changed'));
  await vi.advanceTimersByTimeAsync(30_000);
  expect(harness.request).not.toHaveBeenCalled();
});
