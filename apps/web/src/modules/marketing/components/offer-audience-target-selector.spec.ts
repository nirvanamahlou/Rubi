import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const selectorSource = readFileSync(
  new URL('./offer-audience-target-selector.tsx', import.meta.url),
  'utf8',
);
const referencePagesSource = readFileSync(
  new URL('./marketing-reference-pages.tsx', import.meta.url),
  'utf8',
);

describe('marketing offer audience target contract', () => {
  it('keeps the target optional for both offer forms and validates explicit targeting', () => {
    expect(referencePagesSource).toContain('<OfferAudienceTargetSelector');
    expect(referencePagesSource).toContain('isOffer &&');
    expect(referencePagesSource).toContain("offerAudienceKind !== 'none'");
    expect(referencePagesSource).toContain('!offerAudienceTarget');
    expect(selectorSource).toContain('مخاطب هدف (اختیاری)');
    expect(selectorSource).toContain("['none', 'بدون مخاطب مشخص']");
    expect(selectorSource).toContain("['customer', 'مشتریان']");
    expect(selectorSource).toContain("['agency', 'آژانس‌ها']");
    expect(referencePagesSource).toContain("formKind === 'offer'");
    expect(referencePagesSource).toContain('«${name}» ذخیره شد.');
  });

  it('reads customer and agency references only through their public clients', () => {
    expect(selectorSource).toContain('customersApi.list({');
    expect(selectorSource).toContain("currentConsentStatus === 'granted'");
    expect(selectorSource).toContain("masterDataApi.list('organizations'");
    expect(selectorSource).toContain("organizationRole: 'AGENCY'");
    expect(selectorSource).not.toContain('fetch(');
    expect(selectorSource).not.toContain('repository');
  });

  it('links the selected reference back to its owning section', () => {
    expect(selectorSource).toContain('/customers?customerId=');
    expect(selectorSource).toContain("'/organizations'");
    expect(selectorSource).toContain('متصل به «{value.label}»');
    expect(referencePagesSource).toContain('target.label');
  });
});
