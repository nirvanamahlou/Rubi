import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AccessPermissionsProvider } from '@/modules/iam/access-context';
import { BrokerPurchases } from './broker-purchases';

it('exposes broker purchase amounts only to authorized finance readers', () => {
  const render = (permissions: string[]) =>
    renderToStaticMarkup(
      <AccessPermissionsProvider value={permissions}>
        <BrokerPurchases id="synthetic-broker" />
      </AccessPermissionsProvider>,
    );
  expect(render(['master_data.read'])).toBe('');
  expect(render(['finance.read'])).toContain('خریدهای ثبت‌شده برای کارگزار');
});
