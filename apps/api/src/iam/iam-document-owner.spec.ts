import { expect, it, vi } from 'vitest';
import { IamFinanceDirectory } from './iam-finance-directory';
it('reads only the exact document owner public identity, including inactive or moved owners', async () => {
  const findUnique = vi.fn().mockResolvedValue({
    id: 'historical-owner',
    displayName: 'Historical Seller',
  });
  const directory = new IamFinanceDirectory({
    client: { user: { findUnique } },
  } as never);
  expect(await directory.documentOwnerName('historical-owner')).toEqual({
    id: 'historical-owner',
    displayName: 'Historical Seller',
  });
  expect(findUnique).toHaveBeenCalledExactlyOnceWith({
    where: { id: 'historical-owner' },
    select: { id: true, displayName: true },
  });
});
