import { beforeEach, expect, it, vi } from 'vitest';
import type * as ReactModule from 'react';
import type * as AccessContext from '@/modules/iam/access-context';
import type * as LocaleContext from '@/i18n/locale-context';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReservationPurchaseWorkspace } from './workspace';

const state = vi.hoisted(() => ({
  index: 0,
  query: '',
  setters: [] as ReturnType<typeof vi.fn>[],
  replace: vi.fn(),
  saved: undefined as (() => void) | undefined,
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(state.query),
  useRouter: () => ({ replace: state.replace }),
  usePathname: () => '/ticket-purchases',
}));
vi.mock('@/modules/iam/access-context', async (original) => ({
  ...(await original<typeof AccessContext>()),
  useAccessPermissions: () => ['reservations.read'],
}));
vi.mock('@/i18n/locale-context', async (original) => ({
  ...(await original<typeof LocaleContext>()),
  useDisplayLanguage: () => 'fa',
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  Suspense: ({ children }: { children: ReactNode }) => children,
  useState(initial: unknown) {
    const i = state.index++;
    const setter = vi.fn();
    state.setters[i] = setter;
    return [typeof initial === 'function' ? initial() : initial, setter];
  },
}));
vi.mock('@/components/ui/overlays', () => ({
  Dialog: ({ children }: { children: ReactNode }) => children,
  DialogContent: ({ children }: { children: ReactNode }) => children,
  DialogTitle: ({ children }: { children: ReactNode }) => children,
  DialogDescription: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/modules/reservations/components/reservation-hotel-purchase', () => ({
  ReservationPurchaseDialog: ({ onSaved }: { onSaved: () => void }) => {
    state.saved = onSaved;
    return <span>synthetic-purchase-form</span>;
  },
}));
beforeEach(() => {
  state.index = 0;
  state.setters = [];
  state.saved = undefined;
  state.replace.mockClear();
});
it('closes a successfully saved purchase, refreshes the list and clears only the auto-open deep link', () => {
  state.query =
    'reservationId=synthetic&contractNumber=TEST&status=UNREGISTERED';
  expect(renderToStaticMarkup(<ReservationPurchaseWorkspace />)).toContain(
    'synthetic-purchase-form',
  );
  expect(state.setters[4]).not.toHaveBeenCalled();
  const dispatchEvent = vi.fn();
  vi.stubGlobal('window', { dispatchEvent });
  try {
    state.saved!();
    expect(state.setters[4]).toHaveBeenCalledWith(null);
    const refresh = state.setters[2]!.mock.calls[0]![0] as (
      value: number,
    ) => number;
    expect(refresh(4)).toBe(5);
    expect(state.replace).toHaveBeenCalledWith(
      '/ticket-purchases?contractNumber=TEST&status=UNREGISTERED',
    );
    expect(dispatchEvent.mock.calls[0]?.[0].type).toBe(
      'reservation-workflow-changed',
    );
  } finally {
    vi.unstubAllGlobals();
  }
});
