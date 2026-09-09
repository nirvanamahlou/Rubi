import { describe, expect, it } from 'vitest';
import {
  initialTravelWorkflow,
  transitionTravelWorkflow as transition,
} from './travel-workflow';
import type {
  TravelWorkflowCommandV1,
  TravelWorkflowStateV1,
} from '@rubi/contracts';
const command = (
  state: TravelWorkflowStateV1,
  action: TravelWorkflowCommandV1['action'],
  extra: Partial<TravelWorkflowCommandV1> = {},
): TravelWorkflowCommandV1 => ({
  expectedVersion: state.version,
  action,
  note: 'ثبت عملیاتی',
  ...extra,
});
describe('travel workflow', () => {
  it('requires supplier confirmation before voucher and preserves state on rejection', () => {
    const state = initialTravelWorkflow();
    expect(() =>
      transition(
        state,
        command(state, 'ISSUE_VOUCHER', { acknowledgeMissingInsurance: true }),
        ['p'],
      ),
    ).toThrow();
    expect(state.version).toBe(0);
    expect(() =>
      transition(
        state,
        command(state, 'CONFIRM_SUPPLIER', { supplierReference: 'OK' }),
        ['p'],
      ),
    ).toThrow();
  });
  it('allows optional insurance only after explicit acknowledgement and closes voucher', () => {
    let state = initialTravelWorkflow();
    state = transition(state, command(state, 'REQUEST_SUPPLIER'), ['p']);
    state = transition(
      state,
      command(state, 'CONFIRM_SUPPLIER', { supplierReference: 'BROKER-1' }),
      ['p'],
    );
    expect(() =>
      transition(state, command(state, 'ISSUE_VOUCHER'), ['p']),
    ).toThrow('بیمه');
    state = transition(
      state,
      command(state, 'ISSUE_VOUCHER', { acknowledgeMissingInsurance: true }),
      ['p'],
    );
    expect(state.voucherIssued).toBe(true);
    expect(state.insuranceWarningAcknowledged).toBe(true);
    expect(() => transition(state, command(state, 'CANCEL'), ['p'])).toThrow(
      'بسته',
    );
  });
  it('issues with a recorded insurance reference without extra acknowledgement', () => {
    let state = initialTravelWorkflow();
    for (const action of [
      'REQUEST_SUPPLIER',
      'CONFIRM_SUPPLIER',
      'INSURANCE',
      'ISSUE_VOUCHER',
    ] as const)
      state = transition(
        state,
        command(state, action, {
          supplierReference: 'OK',
          insuranceReference: 'POLICY-1',
        }),
        ['p'],
      );
    expect(state.insuranceWarningAcknowledged).toBe(false);
  });
  it('requires cancellation reason and disallows stale/concurrent commands', () => {
    const state = initialTravelWorkflow();
    expect(() =>
      transition(state, command(state, 'CANCEL', { note: '' }), ['p']),
    ).toThrow();
    const cancelled = transition(state, command(state, 'CANCEL'), ['p']);
    expect(() =>
      transition(cancelled, command(state, 'REQUEST_SUPPLIER'), ['p']),
    ).toThrow();
    expect(() =>
      transition(
        cancelled,
        command(cancelled, 'INSURANCE', { insuranceReference: 'X' }),
        ['p'],
      ),
    ).toThrow();
  });
  it('rejects foreign/duplicate guests and accepts manual age category without mutating source', () => {
    const state = initialTravelWorkflow();
    for (const roomOrder of [['p', 'p'], ['p', 'x'], ['p']])
      expect(() =>
        transition(
          state,
          command(state, 'ARRANGEMENT', { roomOrder, ageOverrides: {} }),
          ['p', 'q'],
        ),
      ).toThrow();
    expect(() =>
      transition(
        state,
        command(state, 'ARRANGEMENT', {
          roomOrder: ['q', 'p'],
          ageOverrides: { x: 'ADULT' },
        }),
        ['p', 'q'],
      ),
    ).toThrow();
    const next = transition(
      state,
      command(state, 'ARRANGEMENT', {
        roomOrder: ['q', 'p'],
        ageOverrides: { p: 'CHILD' },
      }),
      ['p', 'q'],
    );
    expect(next.roomOrder).toEqual(['q', 'p']);
    expect(state.ageOverrides).toEqual({});
  });
});
