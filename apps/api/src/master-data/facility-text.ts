// Keep aligned with MasterFacility.name and its indexed PostgreSQL storage.
export const FACILITY_NAME_MAX_CHARACTERS = 500;

export function postgresCharacterLength(value: string) {
  // PostgreSQL varchar(n) counts Unicode characters, not UTF-16 code units.
  return Array.from(value).length;
}
