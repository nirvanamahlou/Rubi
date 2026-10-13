import { describe, expect, it, vi } from 'vitest';
import { paymentWithReceipt } from './payment-with-receipt';
describe('Payment and receipt failure boundaries', () => {
  it('keeps a successful payment successful after upload failure', async () => {
    const pay = vi.fn().mockResolvedValue({ id: 'payment-1' });
    const upload = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined);
    const result = await paymentWithReceipt(pay, upload);
    expect(result).toEqual({
      payment: { id: 'payment-1' },
      receiptFailed: true,
    });
    await upload(result.payment);
    expect(pay).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenLastCalledWith({ id: 'payment-1' });
  });
  it('does not upload or claim success when payment fails', async () => {
    const upload = vi.fn();
    await expect(
      paymentWithReceipt(
        () => Promise.reject(new Error('payment failed')),
        upload,
      ),
    ).rejects.toThrow('payment failed');
    expect(upload).not.toHaveBeenCalled();
  });
  it('supports no receipt and successful upload', async () => {
    expect(await paymentWithReceipt(async () => 'payment')).toEqual({
      payment: 'payment',
      receiptFailed: false,
    });
    expect(
      await paymentWithReceipt(
        async () => 'payment',
        async () => undefined,
      ),
    ).toEqual({ payment: 'payment', receiptFailed: false });
  });
});
