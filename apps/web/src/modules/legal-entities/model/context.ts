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
