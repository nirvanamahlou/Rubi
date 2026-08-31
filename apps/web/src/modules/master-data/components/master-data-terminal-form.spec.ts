import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MasterDataRecord } from '@rubi/contracts';
import { describe, expect, it, vi } from 'vitest';
vi.mock('./master-data-profile-dialog', () => ({
  MasterDataProfileDialog: ({ children }: { children: ReactNode }) => children,
}));
import { MasterDataTerminalForm } from './master-data-terminal-form';
const record: MasterDataRecord = {
  id: 'terminal-test',
  resource: 'terminals',
  code: 'TERMINAL_TEST',
  name: 'ترمینال آزمون',
  status: 'inactive',
  version: 3,
  createdAt: '2026-08-31T00:00:00Z',
  updatedAt: '2026-08-31T01:00:00Z',
  attributes: {
    englishName: 'Test terminal',
    airportId: 'airport-test',
    airportIataCode: 'TST',
    airportIcaoCode: 'TEST',
    cityName: 'شهر آزمون',
    ianaTimezone: 'Asia/Tehran',
    terminalType: 'MIXED',
    gateCount: 28,
    operatingHoursMode: 'TIME_RANGE',
    opensAt: '05:00',
    closesAt: '24:00',
    isUnderMaintenance: true,
    updatedByUserId: 'test-user',
  },
};
function render(mode: 'create' | 'edit' | 'view', existing?: MasterDataRecord) {
  return renderToStaticMarkup(
    createElement(MasterDataTerminalForm, {
      mode,
      ...(existing ? { record: existing } : {}),
      actorNames: { 'test-user': 'کاربر آزمون' },
      onOpenChange: () => undefined,
      onPersist: async () => undefined,
    }),
  );
}
describe('terminal popup', () => {
  it('covers screenshot columns plus English title and local timezone', () => {
    const html = render('edit', record);
    for (const label of [
      'کد',
      'عنوان فارسی',
      'عنوان انگلیسی',
      'فرودگاه',
      'شهر',
      'نوع ترمینال',
      'تعداد گیت',
      'ساعت فعالیت',
      'شروع فعالیت',
      'پایان فعالیت',
      'آخرین تغییر',
      'وضعیت',
    ])
      expect(html).toContain(label);
    for (const value of [
      'TERMINAL_TEST',
      'Test terminal',
      'TST',
      'TEST',
      'شهر آزمون',
      'Asia/Tehran',
      'کاربر آزمون',
      '24:00',
    ])
      expect(html).toContain(value);
  });
  it('makes linked and audit metadata read-only', () => {
    const html = render('edit', record);
    for (const key of ['code', 'city', 'airportCodes', 'timezone', 'updated'])
      expect(html).toMatch(
        new RegExp(`<input[^>]*id="terminal-${key}"[^>]*readOnly=""`, 'i'),
      );
  });
  it('supports clearing type, hours and status', () => {
    const html = render('edit', record);
    for (const label of ['نوع ترمینال', 'ساعت فعالیت', 'وضعیت'])
      expect(html).toContain(`aria-label="پاک‌کردن ${label}"`);
  });
  it('opens a read-only popup without a save action for viewing', () => {
    const html = render('view', record);
    expect(html).not.toContain('ذخیره ترمینال');
    expect(html).toMatch(/<input[^>]*id="terminal-name"[^>]*disabled=""/i);
    expect(html).toContain('بستن');
  });
  it('does not invent data during creation', () => {
    const html = render('create');
    expect(html).toContain('پس از ثبت، خودکار تولید می‌شود');
    expect(html).not.toContain('id="terminal-opensAt"');
    expect(html).not.toContain('TERMINAL_TEST');
  });
});
