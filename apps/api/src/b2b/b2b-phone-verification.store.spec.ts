import type { AuthenticatedActor } from '@nora/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  B2bPhoneVerificationStore,
  type PhoneVerificationBinding,
} from './b2b-phone-verification.store';

const branchId = '11111111-1111-4111-8111-111111111111';
const registrationId = '22222222-2222-4222-8222-222222222222';
const actor = (
  userId = '33333333-3333-4333-8333-333333333333',
): AuthenticatedActor => ({
  userId,
  sessionId: userId,
  branchIds: [branchId],
  permissions: ['master_data.read', 'master_data.create'],
});
const phone = (index = 0) => `+98912${index.toString().padStart(7, '0')}`;
const binding = (overrides: Partial<ReturnType<typeof baseBinding>> = {}) => ({
  ...baseBinding(),
  ...overrides,
});
const baseBinding = (): PhoneVerificationBinding => ({
  actor: actor(),
  branchId,
  registrationId,
  role: 'AGENCY' as const,
  organizationId: null,
  canonicalPhone: phone(),
});

describe('development phone verification store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-03T10:00:00.000Z'));
    process.env.NODE_ENV = 'development';
  });
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.NODE_ENV;
  });

  it('binds the code and grant to actor, session, branch, draft, role and phone', () => {
    const store = new B2bPhoneVerificationStore();
    const original = binding({
      organizationId: '44444444-4444-4444-8444-444444444444',
    });
    const issued = store.issue(original);
    const mismatches: PhoneVerificationBinding[] = [
      binding({
        organizationId: original.organizationId,
        actor: { ...actor(), userId: '99999999-3333-4333-8333-333333333333' },
      }),
      binding({
        organizationId: original.organizationId,
        actor: {
          ...actor(),
          sessionId: '99999999-3333-4333-8333-333333333333',
        },
      }),
      binding({
        organizationId: original.organizationId,
        branchId: crypto.randomUUID(),
      }),
      binding({
        organizationId: original.organizationId,
        registrationId: crypto.randomUUID(),
      }),
      binding({
        organizationId: original.organizationId,
        role: 'CORPORATE_CUSTOMER',
      }),
      binding({ organizationId: crypto.randomUUID() }),
      binding({
        organizationId: original.organizationId,
        canonicalPhone: phone(1),
      }),
    ];
    for (const mismatch of mismatches)
      expect(() =>
        store.verify(issued.challengeId, issued.code, mismatch),
      ).toThrow();
    const verified = store.verify(issued.challengeId, issued.code, original);
    expect(() =>
      store.inspectGrant(
        verified.grant,
        binding({
          organizationId: original.organizationId,
          canonicalPhone: phone(1),
        }),
      ),
    ).toThrow('معتبر نیست');
    expect(store.inspectGrant(verified.grant, original).canonicalPhone).toBe(
      phone(),
    );
  });

  it('rejects the exact expiry boundary and exhausts five failed attempts', () => {
    const expiring = new B2bPhoneVerificationStore();
    const issued = expiring.issue(binding());
    vi.setSystemTime(issued.expiresAt);
    expect(() =>
      expiring.verify(issued.challengeId, issued.code, binding()),
    ).toThrow();

    vi.setSystemTime(new Date('2026-10-03T11:00:00.000Z'));
    const attempts = new B2bPhoneVerificationStore();
    const challenge = attempts.issue(binding());
    for (let count = 1; count <= 5; count += 1)
      expect(() =>
        attempts.verify(challenge.challengeId, '000000', binding()),
      ).toThrow(count === 5 ? 'تعداد تلاش' : 'صحیح نیست');
    expect(() =>
      attempts.verify(challenge.challengeId, challenge.code, binding()),
    ).toThrow();

    vi.setSystemTime(new Date('2026-10-03T12:00:00.000Z'));
    const grantStore = new B2bPhoneVerificationStore();
    const grantChallenge = grantStore.issue(binding());
    const verified = grantStore.verify(
      grantChallenge.challengeId,
      grantChallenge.code,
      binding(),
    );
    vi.setSystemTime(verified.expiresAt);
    expect(() => grantStore.inspectGrant(verified.grant, binding())).toThrow();
  });

  it('invalidates prior challenges and grants on resend and spends a grant once', () => {
    const store = new B2bPhoneVerificationStore();
    const first = store.issue(binding());
    expect(() =>
      store.issue(binding({ registrationId: crypto.randomUUID() })),
    ).toThrow('صبر');
    const verified = store.verify(first.challengeId, first.code, binding());
    vi.advanceTimersByTime(60_000);
    store.issue(binding());
    expect(() => store.inspectGrant(verified.grant, binding())).toThrow(
      'معتبر نیست',
    );

    vi.advanceTimersByTime(60_000);
    const next = store.issue(binding({ registrationId: crypto.randomUUID() }));
    const nextBinding = binding({ registrationId: crypto.randomUUID() });
    expect(next.challengeId).toBeTruthy();
    // A different draft cannot consume the newly issued challenge/grant.
    expect(() =>
      store.verify(next.challengeId, next.code, nextBinding),
    ).toThrow();
  });

  it('pins existing-organization grants and allows a new-registration grant to claim once', () => {
    const store = new B2bPhoneVerificationStore();
    const existingId = '44444444-4444-4444-8444-444444444444';
    const existing = binding({ organizationId: existingId });
    const issued = store.issue(existing);
    const verified = store.verify(issued.challengeId, issued.code, existing);
    expect(() =>
      store.consume(verified.grant, existing, crypto.randomUUID()),
    ).toThrow('این سازمان');
    store.consume(verified.grant, existing, existingId);
    expect(() => store.consume(verified.grant, existing, existingId)).toThrow(
      'معتبر نیست',
    );

    vi.advanceTimersByTime(60_000);
    const created = binding({ registrationId: crypto.randomUUID() });
    const createdChallenge = store.issue(created);
    const createdGrant = store.verify(
      createdChallenge.challengeId,
      createdChallenge.code,
      created,
    );
    expect(() =>
      store.consume(createdGrant.grant, created, crypto.randomUUID()),
    ).not.toThrow();
  });

  it('enforces phone and actor hourly budgets without evicting live ledgers', () => {
    const phoneStore = new B2bPhoneVerificationStore();
    for (let index = 0; index < 5; index += 1) {
      phoneStore.issue(
        binding({
          actor: actor(
            `${index}`.padStart(8, '0') + '-3333-4333-8333-333333333333',
          ),
          registrationId: crypto.randomUUID(),
        }),
      );
      vi.advanceTimersByTime(60_000);
    }
    expect(() =>
      phoneStore.issue(
        binding({ actor: actor('99999999-3333-4333-8333-333333333333') }),
      ),
    ).toThrow('شماره');

    const actorStore = new B2bPhoneVerificationStore();
    for (let index = 0; index < 20; index += 1) {
      actorStore.issue(
        binding({
          canonicalPhone: phone(index),
          registrationId: crypto.randomUUID(),
        }),
      );
      vi.advanceTimersByTime(60_000);
    }
    expect(() =>
      actorStore.issue(binding({ canonicalPhone: phone(99) })),
    ).toThrow('کاربر');
  });

  it('fails closed at capacity and in every non-development operation', () => {
    const store = new B2bPhoneVerificationStore();
    for (let index = 0; index < 333; index += 1)
      store.issue(
        binding({
          actor: actor(
            `${index.toString().padStart(8, '0')}-3333-4333-8333-333333333333`,
          ),
          canonicalPhone: phone(index),
          registrationId: crypto.randomUUID(),
        }),
      );
    expect(() =>
      store.issue(
        binding({
          actor: actor('99999999-3333-4333-8333-333333333333'),
          canonicalPhone: phone(999),
        }),
      ),
    ).toThrow('ظرفیت');

    process.env.NODE_ENV = 'production';
    expect(() => store.issue(binding())).toThrow('غیرفعال');
    expect(() =>
      store.verify(crypto.randomUUID(), '123456', binding()),
    ).toThrow('غیرفعال');
    expect(() => store.inspectGrant('missing', binding())).toThrow('غیرفعال');
    expect(() =>
      store.consume('missing', binding(), crypto.randomUUID()),
    ).toThrow('غیرفعال');
  });
});
