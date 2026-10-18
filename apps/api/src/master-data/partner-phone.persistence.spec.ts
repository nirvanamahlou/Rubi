import type { Prisma } from '@nora/database';
import { describe, expect, it, vi } from 'vitest';
import {
  hasPartnerPhoneRole,
  persistPartnerPhones,
} from './partner-phone.persistence';

const value = (fingerprint: string) => ({
  encrypted: `cipher-${fingerprint}`,
  encryptionIv: 'iv',
  encryptionAuthTag: 'tag',
  encryptionKeyVersion: 1,
  masked: '***1234',
  fingerprint,
});
function stored(id: string, marker: string, fingerprint: string) {
  const v = value(fingerprint);
  return {
    id,
    jobTitle: marker,
    isActive: true,
    phoneEncrypted: v.encrypted,
    phoneEncryptionIv: v.encryptionIv,
    phoneEncryptionAuthTag: v.encryptionAuthTag,
    phoneEncryptionKeyVersion: 1,
    phoneMasked: v.masked,
    phoneFingerprint: fingerprint,
  };
}
function harness(rows: ReturnType<typeof stored>[] = []) {
  const contacts = {
    findMany: vi.fn().mockResolvedValue(rows),
    updateMany: vi.fn().mockResolvedValue({ count: rows.length }),
    create: vi.fn().mockResolvedValue({ id: 'new' }),
    update: vi.fn().mockResolvedValue({}),
  };
  const audit = vi.fn().mockResolvedValue(undefined);
  const run = (input: Record<string, unknown>) =>
    persistPartnerPhones(
      {
        masterOrganizationContact: contacts,
      } as unknown as Prisma.TransactionClient,
      'org',
      'Synthetic',
      input,
      'actor',
      () => 'CONTACT_TEST',
      audit,
    );
  return { contacts, audit, run };
}
describe('shared partner office/mobile phone persistence', () => {
  it('creates only one encrypted contact when office and mobile are identical', async () => {
    const h = harness();
    await h.run({ office: value('same'), mobile: value('same') });
    expect(h.contacts.create).toHaveBeenCalledTimes(1);
    const data = h.contacts.create.mock.calls[0]?.[0].data;
    expect(data).toMatchObject({
      organizationId: 'org',
      phoneFingerprint: 'same',
      jobTitle: 'PARTNER_OFFICE+PARTNER_MOBILE',
    });
    expect(hasPartnerPhoneRole(data?.jobTitle, 'mobile')).toBe(true);
    expect(hasPartnerPhoneRole(data?.jobTitle, 'office')).toBe(true);
  });
  it('keeps distinct numbers as two contacts', async () => {
    const h = harness();
    await h.run({ office: value('a'), mobile: value('b') });
    expect(h.contacts.create).toHaveBeenCalledTimes(2);
  });
  it('splits a shared contact while retaining the untouched office number', async () => {
    const h = harness([stored('old', 'PARTNER_OFFICE+PARTNER_MOBILE', 'a')]);
    await h.run({ mobile: value('b') });
    expect(h.contacts.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'old' },
        data: expect.objectContaining({
          phoneFingerprint: 'a',
          jobTitle: 'PARTNER_OFFICE',
        }),
      }),
    );
    expect(h.contacts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          phoneFingerprint: 'b',
          jobTitle: 'PARTNER_MOBILE',
        }),
      }),
    );
    expect(h.contacts.updateMany).toHaveBeenCalledWith({
      where: { organizationId: 'org', id: { in: ['old'] } },
      data: { phoneFingerprint: null },
    });
  });
  it('clears one shared role without clearing the other', async () => {
    const h = harness([stored('old', 'PARTNER_OFFICE+PARTNER_MOBILE', 'a')]);
    await h.run({ office: null });
    expect(h.contacts.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isActive: true,
          phoneFingerprint: 'a',
          jobTitle: 'PARTNER_MOBILE',
        }),
      }),
    );
  });
  it('merges two role contacts and clears the redundant fingerprint without deleting history', async () => {
    const h = harness([
      stored('office', 'PARTNER_OFFICE', 'a'),
      stored('mobile', 'PARTNER_MOBILE', 'b'),
    ]);
    await h.run({ mobile: value('a') });
    expect(h.contacts.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'office' },
        data: expect.objectContaining({
          phoneFingerprint: 'a',
          jobTitle: 'PARTNER_OFFICE+PARTNER_MOBILE',
        }),
      }),
    );
    expect(h.contacts.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mobile' },
        data: expect.objectContaining({
          phoneFingerprint: null,
          phoneEncrypted: null,
          isActive: false,
        }),
      }),
    );
    expect(h.contacts.create).not.toHaveBeenCalled();
  });
  it('does not read or mutate phones for an email-only edit', async () => {
    const h = harness();
    await h.run({ email: value('email') });
    expect(h.contacts.findMany).not.toHaveBeenCalled();
  });
  it('propagates failures for transaction rollback and never audits raw encrypted values', async () => {
    const h = harness();
    h.contacts.create.mockRejectedValue(new Error('synthetic failure'));
    await expect(h.run({ mobile: value('a') })).rejects.toThrow(
      'synthetic failure',
    );
    expect(h.audit).not.toHaveBeenCalled();
  });
});
