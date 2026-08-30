import { describe, expect, it } from 'vitest';

import { masterDataResourceKeys } from './catalog';
import {
  getMasterDataSection,
  getMasterDataSectionForResource,
  masterDataSections,
  unlistedMasterDataResources,
} from './sections';

describe('master data sections', () => {
  it('defines the eight requested top-level sections in display order', () => {
    expect(masterDataSections.map((section) => section.title)).toEqual([
      'مالی و پولی',
      'جغرافیا',
      'سازمان‌ها و تأمین‌کنندگان',
      'اقامت',
      'حمل‌ونقل',
      'بیمه',
      'تور و خدمات سفر',
      'مراجع فروش',
    ]);
  });

  it('accounts for every resource once, including preserved unlisted resources', () => {
    const assignedResources = masterDataSections.flatMap(
      (section) => section.resources,
    );
    const allResources = [...assignedResources, ...unlistedMasterDataResources];

    expect(allResources).toHaveLength(masterDataResourceKeys.length);
    expect(new Set(allResources).size).toBe(masterDataResourceKeys.length);
    expect(allResources.sort()).toEqual([...masterDataResourceKeys].sort());
  });

  it('limits travel and sales cards to their four remaining subsections', () => {
    expect(getMasterDataSection('tours-travel-services')?.resources).toEqual([
      'leaders',
      'tour-types',
      'transfer-types',
      'visa-services',
    ]);
    expect(getMasterDataSection('sales-references')?.resources).toEqual([
      'acquaintance-methods',
      'sales-channels',
      'lost-reasons',
      'tags',
    ]);
    expect(
      getMasterDataSection('tours-travel-services')?.description,
    ).not.toMatch(/CIP|اتوبوس/);
    expect(getMasterDataSection('sales-references')?.description).not.toMatch(
      /منبع سرنخ|نوع مشتری|کمپین/,
    );
  });

  it('keeps buses under transportation and hides only the requested references', () => {
    for (const resource of ['bus-companies', 'bus-types'] as const)
      expect(getMasterDataSectionForResource(resource)?.slug).toBe(
        'transportation',
      );
    expect(unlistedMasterDataResources).toEqual([
      'cip-services',
      'lead-sources',
      'customer-types',
      'campaign-types',
    ]);
    for (const resource of unlistedMasterDataResources) {
      expect(masterDataResourceKeys).toContain(resource);
      expect(getMasterDataSectionForResource(resource)).toBeUndefined();
    }
  });

  it('resolves section routes and reverse resource ownership', () => {
    expect(getMasterDataSection('geography')?.resources).toContain('airports');
    expect(getMasterDataSectionForResource('exchange-rates')?.slug).toBe(
      'finance',
    );
    expect(getMasterDataSection('unknown')).toBeUndefined();
  });
});
