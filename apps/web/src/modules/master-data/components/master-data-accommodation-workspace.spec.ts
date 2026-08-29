import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(
    process.cwd(),
    'src/modules/master-data/components/master-data-accommodation-workspace.tsx',
  ),
  'utf8',
);

describe('accommodation workspace', () => {
  it('implements all eight approved mockup tabs', () => {
    for (const label of [
      'هتل‌ها',
      'پروفایل هتل',
      'زنجیره هتل',
      'نوع اتاق',
      'وعده و سرویس',
      'امکانات',
      'ورود گروهی Excel',
      'هتل ترکیبی',
    ])
      expect(source).toContain(label);
  });

  it('keeps every accommodation KPI label identical to the mockup', () => {
    for (const label of [
      'کل هتل‌ها',
      'فروش‌پذیر',
      'کشورها / شهرها',
      'نیازمند تکمیل',
      'کل زنجیره‌ها',
      'زنجیره فعال',
      'هتل‌های عضو',
      'انواع اتاق',
      'نوع فعال',
      'دارای ظرفیت استاندارد',
      'نیازمند تأیید دامنه',
      'کدهای سرویس',
      'Meal Plan',
      'نیازمند بازبینی',
      'کل امکانات',
      'امکان فعال',
      'دسته‌ها',
      'فاقد آیکن',
      'هتل‌های ترکیبی',
      'هتل عضو یکتا',
    ])
      expect(source).toContain(label);
  });

  it('uses real backend/import contracts and no mockup domain fixtures', () => {
    expect(source).toContain('accommodationSummary');
    expect(source).toContain('<HotelImportPanel');
    expect(source).toContain('<MasterDataKpiGrid');
    expect(source).toContain('— · Procurement');
    expect(source).toContain('در انتظار اتصال Documents');
    expect(source).not.toContain('هتل اسپیناس پالاس');
    expect(source).not.toContain('CTR-881');
  });

  it('implements the contextual filters shown in every catalog mockup', () => {
    for (const label of [
      'همه کشورها',
      'همه شهرها',
      'همه درجات',
      'همه ظرفیت‌ها',
      'همه دسته‌ها',
    ])
      expect(source).toContain(label);
    expect(source).toContain('referenceCapacity');
    expect(source).toContain('mealServiceCategory');
    expect(source).toContain('facilityCategory');
  });
});
