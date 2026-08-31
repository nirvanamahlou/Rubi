import { BadRequestException } from '@nestjs/common';
import {
  getMasterDataColumnFilters,
  type MasterDataListQuery,
  type MasterDataResource,
} from '@rubi/contracts';

export function columnFilterWhere(
  resource: MasterDataResource,
  query: Pick<MasterDataListQuery, 'columnFilter1' | 'columnFilter2'>,
): Record<string, unknown>[] {
  const definitions = getMasterDataColumnFilters(resource);
  return [query.columnFilter1, query.columnFilter2].flatMap((input, index) => {
    if (input === undefined || input === '') return [];
    if (typeof input !== 'string' || input.length > 100)
      throw new BadRequestException('مقدار فیلتر ستونی معتبر نیست.');
    const value = input.trim();
    if (!value) return [];
    const definition = definitions[index]!;
    if (
      definition.options &&
      !definition.options.some(([option]) => option === value)
    )
      throw new BadRequestException(`فیلتر ${definition.label} معتبر نیست.`);
    const condition: unknown =
      definition.kind === 'boolean'
        ? value === 'true'
        : definition.kind === 'number'
          ? Number(value)
          : definition.kind === 'enum'
            ? value
            : { contains: value, mode: 'insensitive' };
    return [
      definition.path.reduceRight<Record<string, unknown>>(
        (nested, key, position) => ({
          [key]: position === definition.path.length - 1 ? condition : nested,
        }),
        {},
      ),
    ];
  });
}
