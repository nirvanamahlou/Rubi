import { previewCalls } from './fixture-data';
import { describe, expect, it } from 'vitest';
import { canViewRoute } from '@nora/contracts';
import {
  filterContacts,
  groupCalls,
  normalizePhone,
  saveCall,
  validPhone,
} from './model';

describe('call center contact history', () => {
  it('preserves local caller numbers without guessing an area code', () => {
    expect(validPhone('۲۲۳۳۴۴۵۵')).toBe(true);
    expect(normalizePhone('۲۲۳۳۴۴۵۵')).toBe('22334455');
    expect(validPhone('123abc')).toBe(false);
  });
  it('groups Persian, Arabic and international Iranian phone formats together', () => {
    expect(normalizePhone('+98 (912) 000-0001')).toBe('09120000001');
    expect(normalizePhone('۰۰۹۸۹۱۲۰۰۰۰۰۰۱')).toBe('09120000001');
    expect(normalizePhone('٠٩١٢٠٠٠٠٠٠١')).toBe('09120000001');
    expect(validPhone('+442071234567')).toBe(true);
    expect(validPhone('0912<script>')).toBe(false);
  });
  it('orders by call time, grouping repeat calls as follow-ups regardless of arrival order', () => {
    const original = previewCalls()[0]!;
    const later = {
      ...original,
      id: 'later',
      phone: '+989120000001',
      occurredAt: '2026-10-19T08:00:00Z',
      direction: 'OUTBOUND' as const,
    };
    const another = {
      ...original,
      id: 'another',
      phone: '09120000002',
      occurredAt: '2026-10-18T08:00:00Z',
    };
    const contacts = groupCalls([later, another, original]);
    expect(contacts.map((contact) => contact.phone)).toEqual([
      '09120000001',
      '09120000002',
    ]);
    expect(contacts[0]?.followUps).toBe(1);
    expect(contacts[0]?.latest.id).toBe('later');
    expect(contacts[0]?.calls.map((call) => call.id)).toEqual([
      'later',
      original.id,
    ]);
  });
  it('replays an event without increasing the follow-up count or losing audio', () => {
    const original = previewCalls()[0]!;
    const recording = {
      id: 'audio-1',
      url: '/synthetic-recording.wav',
      title: 'ضبط تماس',
    };
    const calls = saveCall([original], {
      ...original,
      recordings: [recording],
      subject: 'اصلاح موضوع',
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.recordings).toEqual([recording]);
    expect(groupCalls(calls)[0]?.followUps).toBe(0);
    expect(() =>
      saveCall(calls, { ...original, occurredAt: 'invalid' }),
    ).toThrow();
    expect(saveCall(calls, { ...original, phone: '' })[0]?.phone).toBe('');
  });
  it('combines search, direction, source, operator and status filters on the latest contact state', () => {
    const contacts = groupCalls(previewCalls());
    const latest = contacts[0]!.latest;
    const filters = {
      query: '+۹۸۹۱۲۰۰۰۰۰۰۱',
      direction: latest.direction,
      source: latest.source,
      operator: latest.operator,
      status: latest.status,
    };
    expect(filterContacts(contacts, filters)).toHaveLength(1);
    expect(
      filterContacts(contacts, { ...filters, direction: 'INBOUND' }),
    ).toHaveLength(0);
    expect(
      filterContacts(contacts, { ...filters, query: 'غیر موجود' }),
    ).toHaveLength(0);
  });
  it('does not combine unrelated anonymous callers', () => {
    const original = previewCalls()[0]!;
    const contacts = groupCalls([
      { ...original, id: 'one', contactId: 'a', phone: '' },
      { ...original, id: 'two', contactId: 'b', phone: '' },
    ]);
    expect(contacts).toHaveLength(2);
    expect(contacts.every((contact) => contact.followUps === 0)).toBe(true);
  });
  it('inherits the existing Customer Affairs access boundary', () => {
    expect(canViewRoute([], '/customer-affairs/call-center')).toBe(false);
    for (const permissions of [
      ['customer_affairs.read'],
      ['customer_affairs.read.all'],
      ['sales.contracts.read'],
    ]) {
      expect(canViewRoute(permissions, '/customer-affairs/call-center')).toBe(
        canViewRoute(permissions, '/customer-affairs'),
      );
    }
  });
});
