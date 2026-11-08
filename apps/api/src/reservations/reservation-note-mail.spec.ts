import { expect, it } from 'vitest';
import type {
  TravelWorkflowCommandV1,
  TravelWorkflowStateV1,
} from '@nora/contracts';
import {
  mailKey,
  openMail,
  reservationNoteIntent,
  sealMail,
} from './reservation-note-mail';
const command = {
  action: 'REQUEST_SUPPLIER',
  expectedVersion: 1,
} as TravelWorkflowCommandV1;
const state = {
  note: 'INTERNAL SECRET',
  supplierFormSettings: {
    brokerId: 'primary',
    text: { remarks: 'سلام\nExact text\n' },
  },
  hotelSupplierForms: {
    other: { settings: { brokerId: 'other', text: { remarks: 'OTHER NOTE' } } },
  },
} as unknown as TravelWorkflowStateV1;
it('uses the selected form NOTICE, never the internal workflow note or another hotel', () => {
  expect(reservationNoteIntent(state, command)).toEqual({
    brokerId: 'primary',
    scope: 'primary',
    text: 'سلام\nExact text\n',
  });
  expect(
    reservationNoteIntent(state, { ...command, hotelStayKey: 'other' }),
  ).toEqual({ brokerId: 'other', scope: 'other', text: 'OTHER NOTE' });
  expect(() =>
    reservationNoteIntent(state, { ...command, hotelStayKey: 'missing' }),
  ).toThrow();
});
it.each(['a'.repeat(501), 'a\0b'])(
  'rejects an oversized or malformed note',
  (text) => {
    expect(() =>
      reservationNoteIntent(
        {
          ...state,
          supplierFormSettings: {
            ...state.supplierFormSettings!,
            text: { ...state.supplierFormSettings!.text, remarks: text },
          },
        },
        command,
      ),
    ).toThrow();
  },
);
it('requires a broker even for a hotel-only contract', () => {
  const settings = structuredClone(state.supplierFormSettings!);
  delete settings.brokerId;
  expect(() =>
    reservationNoteIntent(
      {
        ...state,
        supplierFormSettings: settings,
      },
      command,
    ),
  ).toThrow();
});
it('allows an empty NOTICE because the PDF itself is the email attachment', () => {
  const settings = structuredClone(state.supplierFormSettings!);
  settings.text.remarks = '';
  expect(
    reservationNoteIntent({ ...state, supplierFormSettings: settings }, command)
      .text,
  ).toBe('');
});
it('encrypts recipient/body with randomized IV and authenticates the row identity', () => {
  const key = mailKey(Buffer.alloc(32, 7).toString('base64'));
  const data = { to: 'synthetic@example.test', text: 'یادداشت آزمایشی' };
  const sealed = sealMail(data, key, 'one');
  expect(sealed).not.toContain('synthetic');
  expect(openMail(sealed, key, 'one')).toEqual(data);
  expect(sealMail(data, key, 'one')).not.toBe(sealed);
  expect(() => openMail(sealed, key, 'two')).toThrow();
  expect(() => openMail(sealed, Buffer.alloc(32, 8), 'one')).toThrow();
  expect(() => openMail(`${sealed}X`, key, 'one')).toThrow();
});
it('requires a canonical 32-byte key and rejects malformed envelopes', () => {
  expect(() => mailKey(undefined)).toThrow();
  expect(() => mailKey(Buffer.alloc(31).toString('base64'))).toThrow();
  expect(() => openMail('bad', Buffer.alloc(32), 'one')).toThrow();
});
