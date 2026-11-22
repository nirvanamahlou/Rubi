import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type {
  ReservationIntakeV1,
  TravelWorkflowStateV1,
} from '@nora/contracts';

vi.mock('@/modules/reservations/components/travel-document', () => ({
  TravelDocument: ({
    salesContractId,
    voucher,
    unbranded,
  }: {
    salesContractId: string;
    voucher: boolean;
    unbranded: boolean;
  }) => (
    <div
      data-contract={salesContractId}
      data-voucher={voucher}
      data-unbranded={unbranded}
    >
      Hotel voucher
    </div>
  ),
}));

vi.mock('@/components/ui/overlays', () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <>{children}</> : null,
  DialogContent: ({ children }: { children: ReactNode }) => (
    <section role="dialog">{children}</section>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
}));

import {
  SalesContractTermsDownload,
  SalesHotelVoucher,
  SalesTravelDocuments,
} from './sales-travel-documents';

describe('Sales contract terms download', () => {
  it('downloads the shared contract terms PDF with a clear filename', () => {
    const html = renderToStaticMarkup(<SalesContractTermsDownload />);

    expect(html).toContain('href="/contracts/terms.pdf"');
    expect(html).toContain('download="مفاد-قرارداد.pdf"');
    expect(html).toContain('aria-label="دانلود PDF مفاد قرارداد"');
    expect(html).toContain('دانلود مفاد قرارداد');
  });

  it('does not expose travel documents before the authorized server read succeeds', () => {
    const html = renderToStaticMarkup(
      <SalesTravelDocuments contractId="synthetic-contract" />,
    );

    expect(html).not.toContain('/contracts/terms.pdf');
    expect(html).toContain('مدارک مسافر · تأیید مالی');
  });
});

describe('Sales hotel voucher availability', () => {
  function renderVoucher({
    hotel = false,
    selected = false,
    issued = false,
    floating = false,
  } = {}) {
    const intake = {
      snapshot: {
        hotelSelection: selected ? { hotelId: 'synthetic-hotel' } : null,
        serviceSelections: [
          {
            kind: 'FLIGHT',
            metadata: floating ? { purchaseSupplyType: 'FLOATING' } : {},
          },
          ...(hotel ? [{ kind: 'HOTEL' }] : []),
        ],
      },
      workflow: { voucherIssued: issued },
    } as unknown as ReservationIntakeV1 & { workflow: TravelWorkflowStateV1 };
    return renderToStaticMarkup(
      <SalesHotelVoucher
        intake={intake}
        contractId="synthetic-contract"
        unbranded
      />,
    );
  }

  it.each([false, true])(
    'omits voucher output for ticket-only contracts even when issued=%s',
    (issued) => {
      expect(renderVoucher({ issued })).toBe('');
    },
  );
  it.each([{ hotel: true }, { selected: true }])(
    'keeps the pending notice for saved hotel facts %j',
    (facts) => {
      expect(renderVoucher(facts)).toContain('واچر هنوز صادر نشده است.');
    },
  );
  it('keeps issued hotel downloads and their contract/branding options', () => {
    const html = renderVoucher({ selected: true, issued: true });
    expect(html).toContain('Hotel voucher');
    expect(html).toContain('data-contract="synthetic-contract"');
    expect(html).toContain('data-voucher="true"');
    expect(html).toContain('data-unbranded="true"');
    expect(html).not.toContain('واچر هنوز');
  });
  it('preserves the floating-contract pending-notice exemption', () => {
    expect(renderVoucher({ selected: true, floating: true })).toBe('');
    expect(
      renderVoucher({ selected: true, floating: true, issued: true }),
    ).toContain('Hotel voucher');
  });
});
