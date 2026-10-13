import { BadRequestException } from '@nestjs/common';

export function createdDateFilter(query: {
  createdFrom?: string;
  createdBefore?: string;
}) {
  const parse = (value: string) => {
    const date = new Date(value);
    if (
      !/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
      !Number.isFinite(date.getTime())
    )
      throw new BadRequestException(
        'تاریخ فیلتر باید زمان معتبر با منطقه زمانی باشد.',
      );
    return date;
  };
  const from = query.createdFrom ? parse(query.createdFrom) : undefined;
  const before = query.createdBefore ? parse(query.createdBefore) : undefined;
  if (from && before && from >= before)
    throw new BadRequestException('پایان بازه نباید قبل از شروع آن باشد.');
  return from || before
    ? {
        createdAt: {
          ...(from ? { gte: from } : {}),
          ...(before ? { lt: before } : {}),
        },
      }
    : {};
}
