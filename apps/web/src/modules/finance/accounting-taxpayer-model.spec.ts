import { describe, it, expect } from 'vitest';
import { taxpayerPages } from './accounting-taxpayer-catalog';
import {
  taxpayerPage,
  changeTaxpayerValue,
  visibleTaxpayerFields,
  publicTaxpayerDraft,
} from './accounting-taxpayer-model';
describe('observed taxpayer forms', () => {
  it('covers13 unique menu leaves and keeps licensed source failure explicit', () => {
    expect(taxpayerPages).toHaveLength(13);
    expect(new Set(taxpayerPages.map((p) => p.route)).size).toBe(13);
    expect(taxpayerPage('taxpayer-system/send-invoices')?.fields).toEqual([]);
    expect(taxpayerPage('taxpayer-system/send-invoices')?.blocker).toContain(
      'لایسنس',
    );
  });
  it('clears hidden direct credentials when switching to trusted company', () => {
    const page = taxpayerPage('taxpayer-system/settings')!;
    const next = changeTaxpayerValue(
      page,
      {
        lkpSendingType_ComboBox_Input: 'ارسال مستقیم',
        txtDirectPrivate: 'test-only-secret',
        txtDirectTaxMemoryID: 'test',
      },
      'lkpSendingType_ComboBox_Input',
      'ارسال از شرکت معتمد',
    );
    expect(next.txtDirectPrivate).toBe('');
    expect(next.txtDirectTaxMemoryID).toBe('');
    expect(
      visibleTaxpayerFields(page, next).some(
        (f) => f.id === 'txtDirectPrivate',
      ),
    ).toBe(false);
  });
  it('never includes sensitive fields in public drafts', () => {
    const page = taxpayerPage('taxpayer-system/settings')!;
    expect(
      publicTaxpayerDraft(page, {
        lkpSendingType_ComboBox_Input: 'ارسال مستقیم',
        txtDirectPrivate: 'test-only-secret',
      }),
    ).not.toHaveProperty('txtDirectPrivate');
  });
  it('clears national identity when selecting civil participation', () => {
    const page = taxpayerPage('taxpayer-system/seller-information')!;
    const next = changeTaxpayerValue(
      page,
      { fvwMain_txtNationalID: 'test' },
      'fvwMain_lkpPartyType_ComboBox_Input',
      'مشارکت مدنی',
    );
    expect(next.fvwMain_txtNationalID).toBe('');
    expect(
      visibleTaxpayerFields(page, next).find(
        (f) => f.id === 'fvwMain_txtCivilParticipationID',
      )?.disabled,
    ).toBe(false);
  });
  it('clears invoice filters when scheduling collection instead of sending', () => {
    const page = taxpayerPage('taxpayer-system/operations/batch-schedules')!;
    const next = changeTaxpayerValue(
      page,
      { lkpActionType_ComboBox_Input: 'ابطال' },
      'lkpOperatins_ComboBox_Input',
      'جمع آوری داده',
    );
    expect(next.lkpActionType_ComboBox_Input).toBe('');
  });
  it('keeps daily/monthly choices mutually exclusive', () => {
    const page = taxpayerPage('taxpayer-system/reports/uncollected-days')!;
    const next = changeTaxpayerValue(
      page,
      { rdoDaily: true },
      'rdoMonthly',
      true,
    );
    expect(next.rdoDaily).toBe(false);
    expect(next.rdoMonthly).toBe(true);
  });
});
