import { describe, expect, it } from 'vitest';
import { PERMISSIONS_KEY } from '../iam/iam.constants';
import { PackagePricingController } from './package-pricing.controller';

describe('PackagePricingController permission metadata', () => {
  it.each([
    ['pricingTours', ['package_pricing.read']],
    ['tourCosts', ['package_pricing.cost.read']],
    ['list', ['package_pricing.read']],
    ['detail', ['package_pricing.read']],
    ['create', ['package_pricing.create']],
    ['archive', ['package_pricing.archive']],
    ['stop', ['package_pricing.stop']],
    ['templates', ['package_pricing.read']],
    ['createTemplate', ['package_pricing.template.manage']],
    ['rules', ['package_pricing.rule.manage']],
    [
      'createPriceVersion',
      ['package_pricing.period.manage', 'package_pricing.rule.manage'],
    ],
    ['publish', ['package_pricing.publish']],
    ['quote', ['package_pricing.quote.create']],
    ['render', ['package_pricing.render']],
    ['audit', ['package_pricing.audit.read']],
  ] as const)('%s requires %j', (method, permissions) => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        PackagePricingController.prototype[method],
      ),
    ).toEqual(permissions);
  });
});
