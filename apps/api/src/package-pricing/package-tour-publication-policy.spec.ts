import 'reflect-metadata';
import { expect, it } from 'vitest';
import { PERMISSIONS_KEY } from '../iam/iam.constants';
import { PackageTourPricingController } from './package-tour-pricing.controller';
it('allows section users to publish while retaining authentication and permission guards', () => {
  expect(
    Reflect.getMetadata(
      PERMISSIONS_KEY,
      PackageTourPricingController.prototype.publish,
    ),
  ).toEqual(['package_pricing.read']);
  expect(
    Reflect.getMetadata('__guards__', PackageTourPricingController),
  ).toHaveLength(2);
});
