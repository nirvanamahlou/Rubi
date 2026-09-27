import { describe, expect, it } from 'vitest';

import { PERMISSIONS_KEY } from '../iam/iam.constants';
import { CustomerAffairsController } from './customer-affairs.controller';

describe('CustomerAffairsController permission metadata', () => {
  it('allows every authenticated role to discover dashboard capabilities', () => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        CustomerAffairsController.prototype.dashboard,
      ),
    ).toEqual([]);
  });

  it('uses read permissions for the on-screen report', () => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        CustomerAffairsController.prototype.report,
      ),
    ).toEqual(['customer_affairs.lead.read', 'customer_affairs.ticket.read']);
  });
});
