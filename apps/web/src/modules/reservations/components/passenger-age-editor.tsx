'use client';
import type {
  SalesContractAmendmentV1,
  SalesPassengerAgeCategory,
  SalesPassengerInput,
} from '@nora/contracts';
import { NativeSearchSelect } from '@/components/ui/native-search-select';

export function changeAmendmentPassengerAge(
  draft: SalesContractAmendmentV1,
  customerId: string,
  category: SalesPassengerAgeCategory,
): SalesContractAmendmentV1 {
  return {
    ...draft,
    passengerCategories: {
      ...draft.passengerCategories,
      [customerId]: category,
    },
    passengers: draft.passengers.map((p) =>
      p.customerId !== customerId
        ? p
        : {
            ...p,
            childAgeBand: category === 'CHD' ? (p.childAgeBand ?? null) : null,
            ...(p.accommodationKind
              ? {
                  accommodationKind:
                    category === 'INF'
                      ? 'INFANT'
                      : category === 'CHD'
                        ? 'CHILD_WITH_BED'
                        : 'DBL',
                }
              : {}),
          },
    ),
  };
}

export function PassengerAgeEditor({
  passenger,
  category,
  disabled,
  onCategory,
  onBand,
  onAccommodation,
}: {
  passenger: SalesPassengerInput;
  category: SalesPassengerAgeCategory;
  disabled: boolean;
  onCategory: (value: SalesPassengerAgeCategory) => void;
  onBand: (value: SalesPassengerInput['childAgeBand']) => void;
  onAccommodation: (
    value: NonNullable<SalesPassengerInput['accommodationKind']>,
  ) => void;
}) {
  return (
    <div className="grid gap-2">
      <NativeSearchSelect
        aria-label={`رده سنی ${passenger.displayNameSnapshot}`}
        value={category}
        disabled={disabled}
        onChange={(e) =>
          onCategory(e.target.value as SalesPassengerAgeCategory)
        }
      >
        <option value="ADT">بزرگسال</option>
        <option value="CHD">کودک</option>
        <option value="INF">نوزاد</option>
      </NativeSearchSelect>
      {category === 'CHD' && (
        <NativeSearchSelect
          aria-label={`رده سنی کودک ${passenger.displayNameSnapshot}`}
          value={passenger.childAgeBand ?? ''}
          disabled={disabled}
          onChange={(e) =>
            onBand(
              e.target.value
                ? (e.target.value as NonNullable<
                    SalesPassengerInput['childAgeBand']
                  >)
                : null,
            )
          }
        >
          <option value="">انتخاب رده سنی کودک</option>
          <option value="AGE_2_6">۲ تا ۶ سال</option>
          <option value="AGE_6_12">۶ تا ۱۲ سال</option>
        </NativeSearchSelect>
      )}
      {passenger.accommodationKind && (
        <NativeSearchSelect
          aria-label={`نوع اقامت ${passenger.displayNameSnapshot}`}
          value={passenger.accommodationKind}
          disabled={disabled}
          onChange={(e) =>
            onAccommodation(
              e.target.value as NonNullable<
                SalesPassengerInput['accommodationKind']
              >,
            )
          }
        >
          {category === 'INF' ? (
            <option value="INFANT">زیر ۲ سال</option>
          ) : category === 'CHD' ? (
            <>
              <option value="CHILD_WITH_BED">کودک با تخت</option>
              <option value="CHILD_WITHOUT_BED">کودک بدون تخت</option>
            </>
          ) : (
            <>
              <option value="DBL">DBL</option>
              <option value="SINGLE">سینگل</option>
            </>
          )}
        </NativeSearchSelect>
      )}
    </div>
  );
}
