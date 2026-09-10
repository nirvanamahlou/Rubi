import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  ReservationIntakeV1,
  TravelWorkflowStateV1,
} from '@rubi/contracts';
import { TravelDocument } from './travel-document';
const intake = {
  snapshot: {
    contractNumber: 'SYNTHETIC',
    passengerIds: [],
    serviceSelections: [],
    hotelSelection: null,
  },
  workflow: {
    version: 1,
    supplierStatus: 'NEW',
    voucherIssued: false,
    roomOrder: [],
    ageOverrides: {},
    branding: {
      kind: 'OWN',
      referenceId: 'company',
      name: 'Synthetic Company',
      logoFileId: null,
      companyCode: 'NIYAYESH_SEIR_SAHAR',
    },
  },
} as unknown as ReservationIntakeV1 & { workflow: TravelWorkflowStateV1 };
describe('travel output branding and readiness', () => {
  it('uses the registered own-company code for its real bundled logo', () => {
    const html = renderToStaticMarkup(<TravelDocument intake={intake} />);
    expect(html).toContain('/brand/niyayesh.png');
    expect(html).toContain('SYNTHETIC');
  });
  it('does not render an unissued voucher', () => {
    const html = renderToStaticMarkup(
      <TravelDocument intake={intake} voucher />,
    );
    expect(html).not.toContain('SYNTHETIC');
    expect(html).toContain('disabled');
  });
  it('does not substitute the own logo for an agency with unavailable logo', () => {
    const html = renderToStaticMarkup(
      <TravelDocument
        intake={{
          ...intake,
          workflow: {
            ...intake.workflow,
            branding: {
              kind: 'AGENCY',
              referenceId: 'agency',
              name: 'Synthetic Agency',
              logoFileId: 'unavailable',
            },
          },
        }}
      />,
    );
    expect(html).not.toContain('/brand/niyayesh-seir-full.png');
    expect(html).toContain('disabled');
  });
});
