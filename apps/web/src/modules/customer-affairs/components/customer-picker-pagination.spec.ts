import { describe, expect, it } from 'vitest';

import {
  customerPickerPagination,
  customerPickerVisibleRecords,
} from './customer-picker-pagination';

describe('Customers picker pagination against the public API', () => {
  it('keeps searched records in ten-result pages without gaps or repeats', () => {
    const customers = Array.from(
      { length: 23 },
      (_, index) => `person-${index + 1}`,
    );
    const visible: string[] = [];
    const requests: Array<[number, number]> = [];

    for (let page = 1; page <= Math.ceil(customers.length / 10); page += 1) {
      const pagination = customerPickerPagination(page);
      requests.push([pagination.requestPage, pagination.requestPageSize]);
      const start = (pagination.requestPage - 1) * pagination.requestPageSize;
      const apiRecords = customers.slice(
        start,
        start + pagination.requestPageSize,
      );
      const pageRecords = customerPickerVisibleRecords(apiRecords, pagination);
      expect(pageRecords).toHaveLength(
        Math.min(10, customers.length - (page - 1) * 10),
      );
      visible.push(...pageRecords);
    }

    expect(requests).toEqual([
      [1, 10],
      [2, 10],
      [3, 10],
    ]);
    expect(visible).toEqual(customers);
  });

  it('keeps ten-result searched pages aligned with API pages', () => {
    const customers = Array.from(
      { length: 23 },
      (_, index) => `person-${index + 1}`,
    );
    const visible: string[] = [];
    for (let page = 1; page <= Math.ceil(customers.length / 10); page += 1) {
      const pagination = customerPickerPagination(page);
      expect(pagination.requestPage).toBe(page);
      expect(pagination.requestPageSize).toBe(10);
      const start = (pagination.requestPage - 1) * pagination.requestPageSize;
      visible.push(
        ...customerPickerVisibleRecords(
          customers.slice(start, start + pagination.requestPageSize),
          pagination,
        ),
      );
    }
    expect(visible).toEqual(customers);
  });
});
