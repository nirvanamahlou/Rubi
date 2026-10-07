import type { MasterDataRecord } from '@nora/contracts';
import {
  masterDataApi,
  type MasterDataPersistWithLogoInput,
} from '@/modules/master-data/api/client';

/** Keep the persisted identity/version when only the logo step fails. */
export async function persistSupplierProfile(
  input: MasterDataPersistWithLogoInput,
  onPersisted: (record: MasterDataRecord) => void,
) {
  const result = await masterDataApi.persistWithLogo(input);
  onPersisted(result.data);
  const logo = String(result.data.attributes.logoFileReference ?? '').trim();
  const previousLogo = String(
    input.existing?.attributes.logoFileReference ?? '',
  ).trim();
  if (
    result.warning &&
    input.logoChange &&
    (input.logoChange.kind === 'remove'
      ? !!logo
      : !logo || logo === previousLogo)
  ) {
    throw new Error(result.warning);
  }
  return result;
}
