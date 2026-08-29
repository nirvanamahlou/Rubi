import { describe, expect, it } from 'vitest';

import { masterDataResourceKeys } from './catalog';
import {
  getMasterDataSection,
  getMasterDataSectionForResource,
  masterDataSections,
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

  it('assigns every implemented resource to exactly one section', () => {
    const assignedResources = masterDataSections.flatMap(
      (section) => section.resources,
    );

    expect(assignedResources).toHaveLength(masterDataResourceKeys.length);
    expect(new Set(assignedResources).size).toBe(masterDataResourceKeys.length);
    expect([...assignedResources].sort()).toEqual(
      [...masterDataResourceKeys].sort(),
    );
  });

  it('resolves section routes and reverse resource ownership', () => {
    expect(getMasterDataSection('geography')?.resources).toContain('airports');
    expect(getMasterDataSectionForResource('exchange-rates')?.slug).toBe(
      'finance',
    );
    expect(getMasterDataSection('unknown')).toBeUndefined();
  });
});
