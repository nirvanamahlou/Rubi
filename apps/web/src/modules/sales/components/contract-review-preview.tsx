'use client';
import { useFlightDocumentFacts } from './use-flight-document-facts';
import { useMemo } from 'react';
import { useLegalEntityContext } from '@/modules/legal-entities/components/legal-entity-context';
import { contractReviewOutput } from '../model/contract-review';
import {
  contractPrintHtml,
  type ContractPrintReferences,
} from '../model/contract-print';
import type { SalesFormState } from '../model/sales-form';
import { salesInternationalTravel } from '../model/sales-form';
import type { SalesReferences } from '../api/reference-refresh';

export function ContractReviewPreview({
  state,
  references,
}: {
  state: SalesFormState;
  references: SalesReferences;
}) {
  const { context } = useLegalEntityContext();
  const company = context?.legalEntity;
  const flightFacts = useFlightDocumentFacts(
    [state.outboundOffer, state.returnOffer].flatMap((offer) =>
      offer
        ? [
            {
              offerId: offer.id,
              originId: offer.originId,
              destinationId: offer.destinationId,
              cabinClassCode: offer.cabinClassCode,
            },
          ]
        : [],
    ),
  );
  const preview = useMemo(() => {
    if (!company)
      return { error: 'برای پیش‌نمایش قرارداد، شرکت فعال را انتخاب کنید.' };
    try {
      const hotel = references.hotels.find((h) => h.id === state.hotel.hotelId);
      const refs: ContractPrintReferences = {
        international: salesInternationalTravel(state),
        flightFacts,
        names: Object.fromEntries(
          Object.values(references)
            .flat()
            .map((r) => [r.id, r.name]),
        ),
        ...(hotel?.attributes.englishName
          ? { hotelLatinName: String(hotel.attributes.englishName) }
          : {}),
        ...(hotel?.attributes.website
          ? { hotelWebsite: String(hotel.attributes.website) }
          : {}),
        ...(hotel?.attributes.starRating != null
          ? { hotelGrade: String(hotel.attributes.starRating) }
          : {}),
      };
      const output = contractReviewOutput(
        state,
        {
          ...company,
          website: null,
          brandingVersion: company.brandingSnapshotVersion,
        },
        new Date().toISOString(),
      );
      return { html: contractPrintHtml(output, refs, { draft: true }) };
    } catch (reason) {
      return {
        error:
          reason instanceof Error
            ? reason.message
            : 'اطلاعات قرارداد برای پیش‌نمایش کامل نیست.',
      };
    }
  }, [state, references, company, flightFacts]);
  return (
    <section
      className="grid min-w-0 gap-3"
      aria-label="پیش‌نمایش قرارداد قبل از ثبت"
    >
      <h3 className="font-bold">پیش‌نمایش قرارداد</h3>
      <p className="text-sm text-muted-foreground">
        پس از بررسی قرارداد، «ثبت و ارسال به رزرواسیون» را بزنید.
      </p>
      {preview.error ? (
        <p role="alert" className="text-sm text-destructive">
          {preview.error}
        </p>
      ) : (
        <iframe
          title="پیش‌نمایش قرارداد قبل از ثبت"
          sandbox=""
          srcDoc={preview.html}
          className="h-[70vh] min-h-80 w-full rounded-xl border border-border bg-white"
        />
      )}
    </section>
  );
}
