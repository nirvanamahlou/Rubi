import type { MasterDataCatalogItem } from './catalog';

// Form visibility is separate from the reference/export catalog.
export function getMasterDataFormFields(definition: MasterDataCatalogItem) {
  if (definition.key !== 'payment-methods') return definition.fields;
  return definition.fields.filter(
    (field) => field.key !== 'code' && field.key !== 'englishName',
  );
}
