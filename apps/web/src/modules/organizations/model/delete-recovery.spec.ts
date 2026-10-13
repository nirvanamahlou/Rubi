import { describe, expect, it } from 'vitest';

import { MasterDataApiError } from '@/modules/master-data/api/client';
import { organizationDeleteFailure } from './delete-recovery';

describe('organization permanent-delete recovery', () => {
  it.each([409, 500])(
    'allows a retry after the owner explicitly rejects the request (%i)',
    (status) => {
      expect(
        organizationDeleteFailure(
          new MasterDataApiError('سازمان حذف نشد.', status),
        ),
      ).toEqual({ message: 'سازمان حذف نشد.', requiresRefresh: false });
    },
  );

  it('requires a refresh when no authoritative owner response was received', () => {
    expect(
      organizationDeleteFailure(new MasterDataApiError('ارتباط قطع شد.', 0)),
    ).toEqual({ message: 'ارتباط قطع شد.', requiresRefresh: true });
    expect(organizationDeleteFailure(new Error('نتیجه نامشخص است.'))).toEqual({
      message: 'نتیجه نامشخص است.',
      requiresRefresh: true,
    });
  });
});
