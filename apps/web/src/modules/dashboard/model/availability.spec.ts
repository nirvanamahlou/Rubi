import { describe, expect, it } from 'vitest';
import { dashboardUnavailableReason } from './availability';

describe('unavailable Dashboard measurement explanations', () => {
  it('does not describe an unposted balance or missing cost as zero', () => {
    expect(
      dashboardUnavailableReason('APPROVED_MATCHED_COST_REQUIRED'),
    ).toContain('سود قابل محاسبه نیست');
    expect(
      dashboardUnavailableReason('POSTED_ACCOUNTING_SOURCE_REQUIRED'),
    ).toContain('اسناد حسابداری قطعی');
    expect(dashboardUnavailableReason('ZERO_DENOMINATOR')).toContain(
      'قابل محاسبه نیست',
    );
  });
  it('gives a bounded remedy for overflow and failed reads without exposing internals', () => {
    expect(dashboardUnavailableReason('SOURCE_ROW_LIMIT')).toContain(
      'بازهٔ تاریخ',
    );
    expect(dashboardUnavailableReason('SOURCE_READ_FAILED')).toContain(
      'دوباره تلاش',
    );
    expect(dashboardUnavailableReason('unexpected secret text')).not.toContain(
      'unexpected',
    );
    expect(dashboardUnavailableReason()).toContain('دسترسی فعلی');
  });
});
