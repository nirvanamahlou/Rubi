import { it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { defaultVoucherSettings } from '../model/voucher-settings';
import type { ReservationFormIntake } from '../model/reservation-form';
import { renderReservationPdf } from './reservation-pdf';

it.runIf(process.env.RESERVATION_PDF_RUNTIME_SMOKE === '1')(
  'renders six synthetic passengers on one actual A4 page without a configured font path',
  async () => {
    const ids = Array.from(
      { length: 6 },
      (_, index) => `passenger-${index + 1}`,
    );
    const intake = {
      id: '00000000-0000-4000-8000-000000000001',
      receivedAt: '2026-09-10T10:00:00Z',
      snapshot: {
        contractNumber: 'SYNTHETIC',
        passengerIds: ids,
        passengerAssignments: ids.map((customerId, index) => ({
          customerId,
          displayNameSnapshot: `SYNTHETIC PASSENGER ${index + 1}`,
          ageCategory: 'ADL',
        })),
        serviceSelections: [],
        hotelSelection: null,
      },
      workflow: {
        version: 1,
        supplierStatus: 'NEW',
        roomOrder: ids,
        ageOverrides: {},
        branding: {
          kind: 'OWN',
          companyCode: 'NIYAYESH_SEIR_SAHAR',
          name: 'Synthetic',
        },
      },
    } as unknown as ReservationFormIntake;
    intake.workflow.supplierFormSettings = defaultVoucherSettings(intake, {});
    intake.workflow.supplierFormSettings.text.broker = 'Synthetic Supplier';
    const [logo, css] = await Promise.all([
      readFile(join(process.cwd(), 'public/brand/niyayesh.png')),
      readFile(
        join(
          process.cwd(),
          'src/modules/reservations/components/reservation-form-sheet.module.css',
        ),
        'utf8',
      ),
    ]);
    const previousFont = process.env.SALES_PDF_NAZANIN_PATH;
    delete process.env.SALES_PDF_NAZANIN_PATH;
    try {
      const pdf = await renderReservationPdf(
        intake,
        {},
        `data:image/png;base64,${logo.toString('base64')}`,
        css,
      );
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      const info = spawnSync('pdfinfo', ['-'], {
        input: pdf,
        encoding: 'utf8',
      });
      expect(info.status).toBe(0);
      expect(info.stdout).toMatch(/^Pages:\s+1$/m);
      expect(info.stdout).toMatch(/^Page size:.*\(A4\)/m);
    } finally {
      if (previousFont === undefined) delete process.env.SALES_PDF_NAZANIN_PATH;
      else process.env.SALES_PDF_NAZANIN_PATH = previousFont;
    }
  },
  60_000,
);
