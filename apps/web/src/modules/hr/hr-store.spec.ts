import type { HrBootstrapDto } from '@nora/contracts';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useHrStore } from './hr-store';

const mocks = vi.hoisted(() => ({
  bootstrap: vi.fn<() => Promise<HrBootstrapDto>>(),
  state: [] as unknown[],
}));

vi.mock('./hr-api', () => ({ hrApi: { bootstrap: mocks.bootstrap } }));
vi.mock('react', () => ({
  useState: <T>(initial: T) => {
    const index = mocks.state.push(initial) - 1;
    return [
      initial,
      (next: T | ((current: T) => T)) => {
        mocks.state[index] =
          typeof next === 'function'
            ? (next as (current: T) => T)(mocks.state[index] as T)
            : next;
      },
    ];
  },
  useRef: <T>(current: T) => ({ current }),
  useCallback: (callback: unknown) => callback,
  useEffect: () => undefined,
}));

const bootstrap = (branch: string): HrBootstrapDto => ({
  branchIds: [branch],
  branches: [{ id: branch, name: branch, code: branch }],
  employees: [],
  records: [],
  capabilities: {
    read: true,
    write: true,
    approve: false,
    sensitive: false,
    audit: false,
    scope: 'branch',
  },
  integrations: {
    finance: 'UNAVAILABLE',
    documents: 'PUBLIC_API',
    notifications: 'HR_PERSISTENT',
    biometric: 'UNAVAILABLE',
  },
  recordCount: 0,
  recordsTruncated: false,
});

beforeEach(() => {
  mocks.bootstrap.mockReset();
  mocks.state.length = 0;
  vi.stubGlobal('window', new EventTarget());
});
afterEach(() => vi.unstubAllGlobals());

it('shares one pending bootstrap and increments the revision once', async () => {
  const store = useHrStore();
  const data = bootstrap('branch-1');
  mocks.bootstrap.mockResolvedValue(data);
  const first = store.refresh();
  expect(store.refresh()).toBe(first);
  await first;
  expect(mocks.bootstrap).toHaveBeenCalledOnce();
  expect(mocks.state).toEqual([data, '', false, 1]);
});

it('reloads after a commit and ignores any older response', async () => {
  const store = useHrStore();
  let resolveOld!: (value: HrBootstrapDto) => void;
  const old = new Promise<HrBootstrapDto>((resolve) => {
    resolveOld = resolve;
  });
  const fresh = bootstrap('after-commit');
  mocks.bootstrap.mockReturnValueOnce(old).mockResolvedValueOnce(fresh);
  const prior = store.refresh();
  await Promise.resolve();
  await store.mutated();
  resolveOld(bootstrap('before-commit'));
  await prior;
  expect(mocks.bootstrap).toHaveBeenCalledTimes(2);
  expect(mocks.state).toEqual([fresh, '', false, 1]);
});

it('releases a failed request and supports retry', async () => {
  const store = useHrStore();
  const data = bootstrap('retry');
  mocks.bootstrap
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValueOnce(data);
  await expect(store.refresh()).rejects.toThrow('network');
  expect(mocks.state).toEqual([null, 'network', false, 0]);
  await store.refresh();
  expect(mocks.state).toEqual([data, '', false, 1]);
});

it('invalidates dependent lists after a commit even when bootstrap fails', async () => {
  const store = useHrStore();
  mocks.bootstrap.mockRejectedValue(new Error('network'));
  await store.mutated();
  expect(mocks.state).toEqual([null, 'network', false, 1]);
});
