const apiPageSize = 10;

/** The Customers API requires at least ten rows per request. */
export function customerPickerPagination(page: number) {
  const displayPageSize = 10;
  const firstIndex = (page - 1) * displayPageSize;
  return {
    displayPageSize,
    requestPage: Math.floor(firstIndex / apiPageSize) + 1,
    requestPageSize: apiPageSize,
    offset: firstIndex % apiPageSize,
  };
}

export function customerPickerVisibleRecords<T>(
  records: readonly T[],
  pagination: ReturnType<typeof customerPickerPagination>,
): readonly T[] {
  return records.slice(
    pagination.offset,
    pagination.offset + pagination.displayPageSize,
  );
}
