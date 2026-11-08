import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  sendMail: vi.fn(),
  close: vi.fn(),
  create: vi.fn(),
}));
vi.mock('nodemailer', () => ({ createTransport: mock.create }));
import {
  mailbox,
  mailConfiguration,
  mailFailure,
  sendNoteMail,
  smtpTransport,
} from './smtp';

const env = {
  RESERVATION_MAIL_ENABLED: 'true',
  RESERVATION_SMTP_HOST: 'smtp.example.test',
  RESERVATION_SMTP_PORT: '587',
  RESERVATION_SMTP_TLS: 'starttls',
  RESERVATION_SMTP_USER: 'synthetic',
  RESERVATION_SMTP_PASSWORD: 'synthetic',
  RESERVATION_MAIL_FROM: 'reservation@example.test',
  RESERVATION_MAIL_FROM_NAME: 'رزرو',
  RESERVATION_MAIL_REPLY_TO: 'reservation@example.test',
};
beforeEach(() => {
  vi.clearAllMocks();
  mock.create.mockReturnValue(mock);
});
it('is off unless explicitly enabled and rejects incomplete configuration', () => {
  expect(mailConfiguration({})).toBeNull();
  expect(() =>
    mailConfiguration({ RESERVATION_MAIL_ENABLED: 'true' }),
  ).toThrow();
  expect(() =>
    mailConfiguration({ ...env, RESERVATION_SMTP_TLS: 'none' }),
  ).toThrow();
  expect(() =>
    mailConfiguration({
      ...env,
      RESERVATION_SMTP_HOST: 'smtp://user:secret@host',
    }),
  ).toThrow();
});
it('requires verified TLS, finite timeouts and disables file/URL access and logging', () => {
  smtpTransport(mailConfiguration(env)!);
  expect(mock.create).toHaveBeenCalledWith(
    expect.objectContaining({
      secure: false,
      requireTLS: true,
      tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
      socketTimeout: 30000,
      disableFileAccess: true,
      disableUrlAccess: true,
      debug: false,
      logger: false,
    }),
  );
  smtpTransport(
    mailConfiguration({
      ...env,
      RESERVATION_SMTP_PORT: '465',
      RESERVATION_SMTP_TLS: 'implicit',
    })!,
  );
  expect(mock.create).toHaveBeenLastCalledWith(
    expect.objectContaining({ secure: true }),
  );
});
it.each([
  'a..b@example.test',
  'a@example..test',
  '.a@example.test',
  'a@-example.test',
  'a@example.test,other@example.test',
  'a@example.test\r\nBcc: b@example.test',
  'User <a@example.test>',
  '',
])('rejects additional recipients/header injection: %s', (input) => {
  expect(() => mailbox(input)).toThrow();
});
it('attaches the exact PDF and has no text or HTML body', async () => {
  mock.sendMail.mockResolvedValue({
    accepted: ['broker@example.test'],
    rejected: [],
    messageId: 'synthetic',
  });
  const pdf = Buffer.from('%PDF-1.4 synthetic NOTICE in PDF');
  await sendNoteMail(mailConfiguration(env)!, {
    id: '11111111-1111-4111-8111-111111111111',
    to: 'broker@example.test',
    subject: 'Reservation / TEST',
    pdfBase64: pdf.toString('base64'),
    filename: 'reservation-form-TEST.pdf',
  });
  expect(mock.sendMail).toHaveBeenCalledWith(
    expect.objectContaining({
      to: { address: 'broker@example.test', name: '' },
      from: { address: 'reservation@example.test', name: 'رزرو' },
    }),
  );
  const input = mock.sendMail.mock.calls[0]![0];
  expect(input.attachments).toEqual([
    {
      filename: 'reservation-form-TEST.pdf',
      content: pdf,
      contentType: 'application/pdf',
    },
  ]);
  expect(input.text).toBeUndefined();
  expect(input.html).toBeUndefined();
  expect(mock.close).toHaveBeenCalledOnce();
});
it('does not report acceptance for a rejected recipient and always closes transport', async () => {
  mock.sendMail.mockResolvedValue({
    accepted: [],
    rejected: ['broker@example.test'],
  });
  await expect(
    sendNoteMail(mailConfiguration(env)!, {
      id: '11111111-1111-4111-8111-111111111111',
      to: 'broker@example.test',
      subject: 'TEST',
      pdfBase64: Buffer.from('%PDF-1.4 synthetic').toString('base64'),
      filename: 'reservation-form-TEST.pdf',
    }),
  ).rejects.toThrow();
  expect(mock.close).toHaveBeenCalledOnce();
});
it('does not blindly retry a timeout/disconnect after DATA or an unknown failure', () => {
  expect(mailFailure({ code: 'ETIMEDOUT', command: 'DATA' })).toBe('UNKNOWN');
  expect(mailFailure({ code: 'ECONNECTION', command: 'DATA' })).toBe('UNKNOWN');
  expect(mailFailure({ code: 'ECONNECTION', command: 'CONN' })).toBe('RETRY');
  expect(mailFailure({ responseCode: 451 })).toBe('RETRY');
  expect(mailFailure({ responseCode: 550 })).toBe('FAILED');
  expect(mailFailure({ code: 'EAUTH' })).toBe('FAILED');
  expect(mailFailure(null)).toBe('UNKNOWN');
});
it('does not submit SMTP DATA without a valid PDF attachment', async () => {
  await expect(
    sendNoteMail(mailConfiguration(env)!, {
      id: '11111111-1111-4111-8111-111111111111',
      to: 'broker@example.test',
      subject: 'TEST',
      pdfBase64: Buffer.from('not a PDF').toString('base64'),
      filename: 'reservation-form.pdf',
    }),
  ).rejects.toThrow('INVALID_PDF_ATTACHMENT');
  expect(mock.sendMail).not.toHaveBeenCalled();
});
