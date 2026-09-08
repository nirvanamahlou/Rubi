// Public, presentation-only entry surface shared with Sales.
export {
  CustomerEntrySheet,
  type CustomerEntryRow,
  type EntryField,
} from '../components/customer-entry-sheet';
export {
  CustomerCalendarSwitch,
  type CustomerCalendarMode,
} from '../components/customer-date-field';
export { customersApi, CustomersApiError } from '../api/client';
export {
  isValidIranianNationalId,
  normalizeNationalId,
} from '../model/customer';
