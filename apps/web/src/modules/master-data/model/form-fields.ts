import { isMasterTransportFormResource } from '@rubi/contracts';
import type {
  MasterDataCatalogItem,
  MasterDataFieldDefinition,
} from './catalog';

// Form visibility is separate from the reference/export catalog.
export function getMasterDataFormFields(definition: MasterDataCatalogItem) {
  if (isMasterTransportFormResource(definition.key)) {
    const fields = definition.fields.map((field): MasterDataFieldDefinition =>
      definition.key === 'train-types' && field.key === 'amenities'
        ? {
            key: 'facilityIds',
            label: 'امکانات مرجع',
            type: 'text',
            placeholder: '',
          }
        : field,
    );
    return [
      ...fields,
      {
        key: 'transportStatus',
        label: 'وضعیت',
        type: 'select' as const,
        placeholder: '',
        options: [
          { value: 'ACTIVE', label: 'فعال' },
          { value: 'INACTIVE', label: 'غیرفعال' },
          {
            value: 'UNDER_REVIEW',
            label:
              definition.key === 'baggage-rules'
                ? 'در انتظار بررسی'
                : 'در حال بررسی',
          },
        ],
        hint: 'تغییر وضعیت نیازمند مجوز مدیریت وضعیت است.',
      },
    ];
  }
  if (definition.key !== 'payment-methods') return definition.fields;
  return definition.fields.filter(
    (field) => field.key !== 'code' && field.key !== 'englishName',
  );
}
