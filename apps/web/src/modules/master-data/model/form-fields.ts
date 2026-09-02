import { isMasterTransportFormResource } from '@rubi/contracts';
import type {
  MasterDataCatalogItem,
  MasterDataFieldDefinition,
} from './catalog';

// Form visibility is separate from the reference/export catalog.
export function getMasterDataFormFields(definition: MasterDataCatalogItem) {
  let fields: readonly MasterDataFieldDefinition[] = definition.fields;
  if (isMasterTransportFormResource(definition.key)) {
    fields = definition.fields.map((field): MasterDataFieldDefinition =>
      definition.key === 'train-types' && field.key === 'amenities'
        ? {
            key: 'facilityIds',
            label: 'امکانات مرجع',
            type: 'text',
            placeholder: '',
          }
        : field,
    );
  }
  if (definition.key === 'payment-methods')
    fields = fields.filter(
      (field) => field.key !== 'code' && field.key !== 'englishName',
    );
  if (
    definition.key !== 'exchange-rates' &&
    !fields.some((field) => field.key === 'displayOrder')
  )
    fields = [
      ...fields,
      {
        key: 'displayOrder',
        label: 'ترتیب نمایش',
        type: 'number',
        placeholder: '0',
        hint: 'عدد صحیح نامنفی؛ مقدار پیش‌فرض صفر است.',
      },
    ];
  if (isMasterTransportFormResource(definition.key))
    fields = [
      ...fields,
      {
        key: 'transportStatus',
        label: 'وضعیت',
        type: 'select',
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
        hint: 'مقدار پیش‌فرض فعال است؛ تغییر وضعیت نیازمند مجوز مدیریت وضعیت است.',
      },
    ];
  return fields;
}
