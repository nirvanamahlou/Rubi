import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://api.test/api/v1',
}));
import { travelRequest, workflowOperationNote } from './travel-workflow-form';
afterEach(() => vi.unstubAllGlobals());
it('records the explicit supplier action when optional details are blank, preserving mandatory reasons elsewhere', () => {
  expect(workflowOperationNote('REQUEST_SUPPLIER', '  ')).toBe(
    'ثبت ارسال فرم رزرواسیون به کارگزار',
  );
  expect(workflowOperationNote('REQUEST_SUPPLIER', ' detail ')).toBe('detail');
  expect(workflowOperationNote('CANCEL', '  ')).toBe('');
  expect(workflowOperationNote('CONFIRM_SUPPLIER', '')).toBe('');
});
it('shows the normalized API validation reason instead of a false generic access error', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { error: { message: 'دلیل عملیات را وارد کنید.' } },
          { status: 400 },
        ),
      ),
  );
  await expect(
    travelRequest('reservations/requests/qa/workflow', {}),
  ).rejects.toThrow('دلیل عملیات را وارد کنید.');
});
