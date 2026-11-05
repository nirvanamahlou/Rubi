import type { AccountingAttributes } from '@nora/contracts';
import * as v from './accounting.validation';
import { setupNotes } from './accounting.setup-notes';
export function fiscalYearAttributes(
  attributes: AccountingAttributes,
  previous: AccountingAttributes | undefined,
  actorName: string,
): AccountingAttributes {
  if (Object.keys(attributes).some((key) => key !== 'notes'))
    v.invalid('بازه سال مالی فقط در تخصیص سال به دفتر ثبت می‌شود.');
  return attributes.notes === undefined
    ? {}
    : {
        notes: JSON.stringify(
          setupNotes(attributes.notes, previous?.notes, actorName),
        ),
      };
}
