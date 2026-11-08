import { createHash, createHmac } from 'node:crypto';
import 'reflect-metadata';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type {
  AuthenticatedActor,
  TravelWorkflowCommandV1,
  TravelWorkflowStateV1,
} from '@nora/contracts';
import { ReservationMailService } from './reservation-mail.service';
import { mailKey, openMail } from './reservation-note-mail';

const actor = {
  userId: 'actor',
  branchIds: ['branch'],
  permissions: ['reservations.documents.manage'],
} as AuthenticatedActor;
const state = {
  supplierFormSettings: {
    brokerId: 'broker',
    text: { remarks: 'سلام\nExact NOTICE\n' },
  },
} as unknown as TravelWorkflowStateV1;
const command = {
  action: 'REQUEST_SUPPLIER',
  expectedVersion: 1,
} as TravelWorkflowCommandV1;
const pdfBytes = Buffer.from('%PDF-1.4 synthetic');
const secret = 's'.repeat(32);
const signed = {
  bytes: pdfBytes,
  signature: createHmac('sha256', secret)
    .update(
      JSON.stringify([
        'reservation-pdf-v1',
        'intake',
        1,
        '',
        createHash('sha256').update(pdfBytes).digest('hex'),
      ]),
    )
    .digest('hex'),
};
const key = Buffer.alloc(32, 6).toString('base64');
beforeEach(() => {
  vi.stubEnv('RESERVATION_PDF_MAIL_SECRET', secret);
  for (const [name, value] of Object.entries({
    RESERVATION_MAIL_ENABLED: 'true',
    RESERVATION_MAIL_KEY_BASE64: key,
    RESERVATION_MAIL_LEGAL_ENTITY_ID: 'company',
    RESERVATION_SMTP_HOST: 'smtp.example.test',
    RESERVATION_SMTP_PORT: '587',
    RESERVATION_SMTP_TLS: 'starttls',
    RESERVATION_SMTP_USER: 'synthetic',
    RESERVATION_SMTP_PASSWORD: 'synthetic',
    RESERVATION_MAIL_FROM: 'reservation@example.test',
    RESERVATION_MAIL_FROM_NAME: 'Synthetic',
    RESERVATION_MAIL_REPLY_TO: 'reservation@example.test',
  }))
    vi.stubEnv(name, value);
});
afterEach(() => vi.unstubAllEnvs());
function fixture() {
  const master = {
    detail: vi.fn().mockResolvedValue({
      data: { attributes: { organizationId: 'organization' } },
    }),
    list: vi.fn().mockResolvedValue({
      data: [{ id: 'contact', attributes: { jobTitle: 'PARTNER_EMAIL' } }],
      meta: { total: 1 },
    }),
    unmaskOrganizationContact: vi
      .fn()
      .mockResolvedValue({ data: { email: 'broker@example.test' } }),
  };
  const directory = {
    brokerReference: vi
      .fn()
      .mockResolvedValue({ id: 'broker', source: 'BROKER' }),
  };
  type D = ConstructorParameters<typeof ReservationMailService>;
  return {
    master,
    directory,
    service: new ReservationMailService(
      {} as D[0],
      master as unknown as D[1],
      directory as unknown as D[2],
      {} as D[3],
    ),
  };
}
it('resolves exactly the explicit dossier email via audited public ports and encrypts the snapshot', async () => {
  const { master, service } = fixture();
  const result = await service.prepare(
    state,
    command,
    actor,
    'branch',
    'SYNTHETIC',
    'company',
    signed,
    'intake',
  );
  expect(master.list).toHaveBeenCalledWith(
    'organization-contacts',
    expect.objectContaining({
      organizationId: 'organization',
      status: 'active',
    }),
  );
  expect(master.unmaskOrganizationContact).toHaveBeenCalledWith(
    'contact',
    actor,
    'branch',
  );
  expect(openMail(result.envelope, mailKey(key), result.id)).toMatchObject({
    pdfBase64: pdfBytes.toString('base64'),
    to: 'broker@example.test',
    from: 'reservation@example.test',
    legalEntityId: 'company',
  });
  expect(result.envelope).not.toContain('broker@example.test');
});
it('fails closed when off, missing credentials, wrong company or missing encryption key, before contact access', async () => {
  const { master, service } = fixture();
  for (const company of [undefined, 'other'])
    await expect(
      service.prepare(
        state,
        command,
        actor,
        'branch',
        'TEST',
        company,
        signed,
        'intake',
      ),
    ).rejects.toThrow();
  vi.stubEnv('RESERVATION_MAIL_ENABLED', 'false');
  await expect(
    service.prepare(
      state,
      command,
      actor,
      'branch',
      'TEST',
      'company',
      signed,
      'intake',
    ),
  ).rejects.toThrow();
  expect(master.detail).not.toHaveBeenCalled();
});
it('does not choose an arbitrary person or ambiguous email contact', async () => {
  const { master, service } = fixture();
  for (const data of [
    [],
    [{ id: 'person', attributes: { jobTitle: 'Manager' } }],
    [
      { id: 'a', attributes: { jobTitle: 'PARTNER_EMAIL' } },
      { id: 'b', attributes: { jobTitle: 'PARTNER_EMAIL' } },
    ],
  ]) {
    master.list.mockResolvedValue({ data, meta: { total: data.length } });
    await expect(
      service.prepare(
        state,
        command,
        actor,
        'branch',
        'TEST',
        'company',
        signed,
        'intake',
      ),
    ).rejects.toThrow();
  }
  expect(master.unmaskOrganizationContact).not.toHaveBeenCalled();
});
it('rejects a missing broker/email and propagates inactive-broker and audit failures', async () => {
  const { master, directory, service } = fixture();
  master.unmaskOrganizationContact.mockResolvedValue({ data: { email: '' } });
  await expect(
    service.prepare(
      state,
      command,
      actor,
      'branch',
      'TEST',
      'company',
      signed,
      'intake',
    ),
  ).rejects.toThrow();
  directory.brokerReference.mockRejectedValue(new Error('INACTIVE'));
  await expect(
    service.prepare(
      state,
      command,
      actor,
      'branch',
      'TEST',
      'company',
      signed,
      'intake',
    ),
  ).rejects.toThrow('INACTIVE');
});
it('inserts the prepared row using the caller transaction and the saved revision FK', async () => {
  const { service } = fixture();
  const tx = { $executeRaw: vi.fn().mockResolvedValue(1) };
  await service.enqueue(
    tx as never,
    { id: 'mail-id', contactId: 'contact', envelope: 'sealed' },
    'revision',
  );
  const sql = tx.$executeRaw.mock.calls[0]![0];
  expect(sql.values).toEqual(['mail-id', 'revision', 'contact', 'sealed']);
});
it('rejects a missing or unsigned PDF before accessing any recipient', async () => {
  const { master, service } = fixture();
  await expect(
    service.prepare(
      state,
      command,
      actor,
      'branch',
      'TEST',
      'company',
      undefined,
      'intake',
    ),
  ).rejects.toThrow();
  await expect(
    service.prepare(
      state,
      command,
      actor,
      'branch',
      'TEST',
      'company',
      { ...signed, signature: '0'.repeat(64) },
      'intake',
    ),
  ).rejects.toThrow();
  expect(master.detail).not.toHaveBeenCalled();
});
