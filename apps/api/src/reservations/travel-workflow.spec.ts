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
    expect(() =>
      transition(
        state,
        command(state, 'CONFIRM_SUPPLIER', { supplierReference: 'BROKER-1' }),
        ['p'],
      ),
    ).toThrow('بیمه');
    expect(state.supplierStatus).toBe('REQUESTED');
    expect(state.voucherIssued).toBe(false);
    state = transition(
      state,
      command(state, 'CONFIRM_SUPPLIER', {
        supplierReference: 'BROKER-1',
        acknowledgeMissingInsurance: true,
      }),
      ['p'],
    );
    expect(state.supplierStatus).toBe('CONFIRMED');
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
      'INSURANCE',
      'CONFIRM_SUPPLIER',
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
    expect(state.voucherIssued).toBe(true);
  });
  it('retains voucher issuance for previously confirmed records', () => {
    const state = {
      ...initialTravelWorkflow(),
      supplierStatus: 'CONFIRMED' as const,
    };
    expect(
      transition(
        state,
        command(state, 'ISSUE_VOUCHER', { acknowledgeMissingInsurance: true }),
        [],
      ).voucherIssued,
    ).toBe(true);
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

it('appends durable notes independently of issuance and preserves the operational note', () => {
  const state = {
    ...initialTravelWorkflow(),
    voucherIssued: true,
    note: 'issued',
  };
  const first = transition(
    state,
    command(state, 'NOTE', { note: 'Sales follow-up' }),
    [],
  );
  expect(first.reservationNotes).toEqual(['Sales follow-up']);
  expect(first.note).toBe('issued');
  expect(first.voucherIssued).toBe(true);
  const second = transition(
    first,
    command(first, 'NOTE', { note: 'Another note' }),
    [],
  );
  expect(second.reservationNotes).toEqual(['Sales follow-up', 'Another note']);
  expect(() => transition(second, command(first, 'NOTE'), [])).toThrow();
  expect(() =>
    transition(state, command(state, 'NOTE', { note: ' ' }), []),
  ).toThrow();
});
