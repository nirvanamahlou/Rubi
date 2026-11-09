import { expect, it, vi } from 'vitest';
import { Readable } from 'node:stream';
import { SalesDocumentBrandingController } from './sales-document-branding.controller';
function setup() {
  const detail = vi
    .fn()
    .mockResolvedValue({ data: { status: 'SENT_TO_RESERVATION' } });
  const intake = {
    workflow: {
      supplierStatus: 'CONFIRMED',
      branding: { logoFileId: 'saved-logo' },
    },
  };
  const forContract = vi.fn().mockResolvedValue(intake);
  const release = vi.fn().mockResolvedValue({ approved: true });
  const preview = vi.fn().mockResolvedValue({
    stream: Readable.from(['png']),
    mimeType: 'image/png',
  });
  const controller = new SalesDocumentBrandingController(
    { detail } as never,
    { forContract, floatingDocumentOutput: vi.fn(async (x) => x) } as never,
    { readCustomerContract: release } as never,
    { previewReleasedTravelLogo: preview } as never,
  );
  const req = {
    actor: { permissions: ['sales.contracts.read.own'], branchIds: ['branch'] },
    headers: {},
    ip: '127.0.0.1',
  } as never;
  return { controller, req, detail, intake, release, preview };
}
it('serves only the saved logo after contract scope and financial release, without document or reservation grants', async () => {
  const x = setup();
  await x.controller.logo('contract', x.req);
  expect(x.detail).toHaveBeenCalledWith('contract', x.req['actor']);
  expect(x.preview).toHaveBeenCalledWith(
    'saved-logo',
    x.req['actor'],
    expect.any(Object),
  );
});
it.each([
  'outside-scope',
  'locked',
  'cancelled-contract',
  'cancelled-intake',
  'no-logo',
])('blocks logo delivery for %s', async (kind) => {
  const x = setup();
  if (kind === 'outside-scope') x.detail.mockRejectedValue(new Error('denied'));
  if (kind === 'locked') x.release.mockResolvedValue({ approved: false });
  if (kind === 'cancelled-contract')
    x.detail.mockResolvedValue({ data: { status: 'CANCELLED' } });
  if (kind === 'cancelled-intake')
    x.intake.workflow.supplierStatus = 'CANCELLED';
  if (kind === 'no-logo') x.intake.workflow.branding.logoFileId = '';
  await expect(x.controller.logo('contract', x.req)).rejects.toThrow();
  expect(x.preview).not.toHaveBeenCalled();
});
