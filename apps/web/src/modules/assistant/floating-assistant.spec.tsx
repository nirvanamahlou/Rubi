import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { assistantCopy as c } from '@/i18n/assistant-copy';
import { FloatingAssistant, assistantScopeKey } from './floating-assistant';

const state = vi.hoisted(() => ({
  actor: null as AuthenticatedActor | null,
  language: 'fa',
}));
vi.mock('@/modules/iam/access-context', () => ({
  useAccessActor: () => state.actor,
}));
vi.mock('@/components/system-preferences-provider', () => ({
  useSystemPreferences: () => ({ language: state.language }),
}));
vi.mock('next/dynamic', () => ({ default: () => () => null }));

describe('authenticated floating assistant', () => {
  it('does not render without a valid actor', () => {
    state.actor = null;
    expect(renderToStaticMarkup(<FloatingAssistant />)).toBe('');
  });
  it('starts collapsed for an ordinary authenticated user without requiring corporate data permissions', () => {
    state.actor = {
      userId: 'synthetic-user',
      sessionId: 'synthetic-session',
      permissions: [],
      branchIds: [],
    } as unknown as AuthenticatedActor;
    state.language = 'fa';
    const html = renderToStaticMarkup(<FloatingAssistant />);
    expect(html).toContain(c.widgetOpen[0]);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain(c.widgetMoveHint[0]);
    expect(html).toContain('aria-describedby=');
    expect(html).not.toContain('role="dialog"');
    state.language = 'en';
    expect(renderToStaticMarkup(<FloatingAssistant />)).toContain(
      c.widgetOpen[1],
    );
    expect(renderToStaticMarkup(<FloatingAssistant />)).toContain(
      c.widgetMoveHint[1],
    );
  });
  it('preserves chat through token refresh and ordering changes, but isolates identity and access changes', () => {
    const actor = {
      userId: 'one',
      sessionId: 'old',
      branchIds: ['b', 'a'],
      permissions: ['sales.contract.read', 'customer_affairs.lead.read'],
    } as unknown as AuthenticatedActor;
    const key = assistantScopeKey(actor);
    expect(
      assistantScopeKey({
        ...actor,
        sessionId: 'new',
        branchIds: ['a', 'b'],
        permissions: ['customer_affairs.lead.read', 'sales.contract.read'],
      } as AuthenticatedActor),
    ).toBe(key);
    expect(assistantScopeKey({ ...actor, userId: 'two' })).not.toBe(key);
    expect(assistantScopeKey({ ...actor, branchIds: ['a'] })).not.toBe(key);
    expect(assistantScopeKey({ ...actor, permissions: [] })).not.toBe(key);
    expect(actor.branchIds).toEqual(['b', 'a']);
  });
});
