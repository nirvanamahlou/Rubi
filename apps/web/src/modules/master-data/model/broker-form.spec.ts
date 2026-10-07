import { describe, expect, it, vi } from 'vitest';
import type { MasterDataRecord } from '@nora/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, type ReactNode } from 'react';
import { MasterDataBrokerForm } from '../components/master-data-broker-form';
import {
  brokerFormValues,
  brokerLeaderValues,
  brokerMutationValues,
} from './broker-form';

vi.mock('../components/master-data-profile-dialog', () => ({
  MasterDataProfileDialog: ({ children }: { children: ReactNode }) =>
    createElement('div', null, children),
}));
vi.mock('../components/master-data-reference-selector', () => ({
  MasterDataReferenceSelector: ({ label }: { label: string }) =>
    createElement('button', { type: 'button' }, label),
}));

const record = {
  id: 'broker',
  resource: 'brokers',
  name: 'کارگزار',
  attributes: {
    countryId: 'country',
    cityId: 'old-city',
    boardText: 'TEST BOARD',
    primaryPhoneMasked: '***1234',
    leadersJson: JSON.stringify([
      {
        id: 'leader',
        version: 2,
        name: 'Existing',
        primaryPhoneMasked: '***5678',
      },
    ]),
  },
} as unknown as MasterDataRecord;
describe('broker form', () => {
  it('keeps legacy city and airport Board, without putting masked contacts in input values', () => {
    expect(brokerFormValues(record)).toMatchObject({
      cityIds: 'old-city',
      boardText: 'TEST BOARD',
      primaryPhone: '',
    });
    expect(brokerLeaderValues(record)[0]).toMatchObject({
      id: 'leader',
      version: 2,
      phone: '',
      phoneMasked: '***5678',
    });
  });
  it('omits untouched phones, carries leader version and records explicit removals', () => {
    const values = brokerMutationValues(
      brokerFormValues(record),
      brokerLeaderValues(record),
      record,
    );
    expect(values).not.toHaveProperty('primaryPhone');
    expect(JSON.parse(values.leaderDrafts!)).toEqual({
      items: [{ id: 'leader', version: 2, name: 'Existing' }],
      removed: [],
    });
    expect(
      JSON.parse(
        brokerMutationValues(brokerFormValues(record), [], record)
          .leaderDrafts!,
      ),
    ).toEqual({ items: [], removed: [{ id: 'leader', version: 2 }] });
  });
  it('sends independent numbers for multiple new leaders and explicit broker phone edits', () => {
    const leaders = ['1', '2'].map((key) => ({
      key,
      name: `Leader ${key}`,
      phone: `+90555123456${key}`,
      phoneMasked: '',
      phoneTouched: true,
    }));
    const values = brokerMutationValues(
      {
        ...brokerFormValues(record),
        primaryPhone: '+989121234567',
        cityIds: 'city-a,city-b',
      },
      leaders,
      record,
      true,
    );
    expect(values.primaryPhone).toBe('+989121234567');
    expect(JSON.parse(values.leaderDrafts!).items).toEqual([
      { name: 'Leader 1', phone: '+905551234561' },
      { name: 'Leader 2', phone: '+905551234562' },
    ]);
  });
  it.each(['کارگزار ۱ / تست', "O'Neil & Partners", '旅行社', 'А'])(
    'preserves unrestricted names and phone formats for %s in create payload',
    (name) => {
      const values = brokerMutationValues(
        { name, primaryPhone: '۱۲۳', countryId: 'country', cityIds: 'city' },
        [
          {
            key: 'new-1',
            name,
            phone: '+90 555 123 4567 ext 42',
            phoneMasked: '',
            phoneTouched: true,
          },
        ],
      );
      expect(values.name).toBe(name);
      expect(values.primaryPhone).toBe('۱۲۳');
      expect(JSON.parse(values.leaderDrafts!).items).toEqual([
        { name, phone: '+90 555 123 4567 ext 42' },
      ]);
    },
  );

  it('renders only the requested identity/cities/leader form and a submit action', () => {
    const html = renderToStaticMarkup(
      createElement(MasterDataBrokerForm, {
        mode: 'create',
        onOpenChange: () => undefined,
        onPersist: async () => undefined,
      }),
    );
    for (const label of [
      'نام فارسی کارگزار',
      'نام انگلیسی کارگزار',
      'شماره کارگزار',
      'Board',
      'شهرهای فعالیت',
      'افزودن تورلیدر',
      'ثبت کارگزار',
    ])
      expect(html).toContain(label);
    for (const label of [
      'سازمان کارگزار',
      'خدمات قابل ارائه',
      'ترتیب نمایش',
      'لوگوی کارگزار',
    ])
      expect(html).not.toContain(label);
  });
});
