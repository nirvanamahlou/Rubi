/** Receipt failure does not invalidate a committed payment. */
export async function paymentWithReceipt<T>(
  pay: () => Promise<T>,
  upload?: (payment: T) => Promise<unknown>,
) {
  const payment = await pay();
  if (upload) {
    try {
      await upload(payment);
    } catch {
      return { payment, receiptFailed: true };
    }
  }
  return { payment, receiptFailed: false };
}
