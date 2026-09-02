import {
  LEGAL_ENTITY_CONTEXT_ALL,
  type LegalEntitySelection,
  type LegalEntitySummary,
} from '@rubi/contracts';

export interface LegalEntityChoice {
  value: LegalEntitySelection;
  label: string;
  aggregate: boolean;
  entity: LegalEntitySummary | null;
}

export interface LegalEntityBrand {
  alt: string;
  label: string;
  src: string;
  width: number;
  height: number;
}

const niyayeshSeirBrand: LegalEntityBrand = {
  alt: 'لوگوی شرکت نیایش سیر سحر',
  label: 'CRM شرکت نیایش سیر سحر',
  src: '/brand/niyayesh.png',
  width: 1758,
  height: 742,
};

const jahanBastanBrand: LegalEntityBrand = {
  alt: 'لوگوی شرکت جهان باستان',
  label: 'CRM شرکت جهان باستان',
  src: '/brand/jahan-bastan-horizontal.png',
  width: 2048,
  height: 768,
};

export function legalEntityBrand(
  selection: LegalEntitySelection | null | undefined,
): LegalEntityBrand {
  return selection === 'JAHAN_BASTAN' ? jahanBastanBrand : niyayeshSeirBrand;
}

export function legalEntityChoices(
  entities: readonly LegalEntitySummary[],
  canAggregate: boolean,
): LegalEntityChoice[] {
  return [
    ...entities.map((entity) => ({
      value: entity.code,
      label: entity.persianName.replace(/^شرکت\s+/, ''),
      aggregate: false,
      entity,
    })),
    ...(canAggregate
      ? [
          {
            value: LEGAL_ENTITY_CONTEXT_ALL,
            label: 'هر دو شرکت — ویژه مدیران',
            aggregate: true,
            entity: null,
          },
        ]
      : []),
  ];
}

export function legalEntitySelectionLabel(
  selection: LegalEntitySelection,
  entities: readonly LegalEntitySummary[],
): string {
  if (selection === LEGAL_ENTITY_CONTEXT_ALL) return 'هر دو شرکت';
  return (
    entities
      .find(({ code }) => code === selection)
      ?.persianName.replace(/^شرکت\s+/, '') ?? 'شرکت صادرکننده'
  );
}

export const combinedOfficialDocumentAllowed = (
  selection: LegalEntitySelection,
): boolean => selection !== LEGAL_ENTITY_CONTEXT_ALL;
