import { createTransport } from 'nodemailer';

export type MailConfiguration = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  fromName: string;
  replyTo: string;
};

export type NoteMail = {
  id: string;
  to: string;
  subject: string;
  pdfBase64: string;
  filename: string;
};

export function mailbox(value: string): string {
  const [local, domain] = value.split('@');
  if (
    value.length > 254 ||
    !local ||
    local.length > 64 ||
    local.startsWith('.') ||
    local.endsWith('.') ||
    local.includes('..') ||
    !domain ||
    domain
      .split('.')
      .some(
        (label) =>
          !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label),
      ) ||
    !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(
      value,
    )
  )
    throw new Error('INVALID_MAILBOX');
  return value;
}

/** No defaults for identities or credentials: an incomplete setup cannot send. */
export function mailConfiguration(
  env: NodeJS.ProcessEnv,
): MailConfiguration | null {
  if (env.RESERVATION_MAIL_ENABLED !== 'true') return null;
  const required = (name: string) => {
    const value = env[name];
    if (!value || /[\r\n\0]/.test(value)) throw new Error('MAIL_CONFIGURATION');
    return value;
  };
  const host = required('RESERVATION_SMTP_HOST');
  if (!/^[a-zA-Z0-9.-]+$/.test(host)) throw new Error('MAIL_CONFIGURATION');
  const port = Number(required('RESERVATION_SMTP_PORT'));
  const mode = required('RESERVATION_SMTP_TLS');
  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !['implicit', 'starttls'].includes(mode)
  )
    throw new Error('MAIL_CONFIGURATION');
  return {
    host,
    port,
    secure: mode === 'implicit',
    user: required('RESERVATION_SMTP_USER'),
    password: required('RESERVATION_SMTP_PASSWORD'),
    from: mailbox(required('RESERVATION_MAIL_FROM')),
    fromName: required('RESERVATION_MAIL_FROM_NAME'),
    replyTo: mailbox(required('RESERVATION_MAIL_REPLY_TO')),
  };
}

export function smtpTransport(config: MailConfiguration) {
  return createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure,
    auth: { user: config.user, pass: config.password },
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    disableFileAccess: true,
    disableUrlAccess: true,
    logger: false,
    debug: false,
  });
}

export async function sendNoteMail(config: MailConfiguration, mail: NoteMail) {
  mailbox(mail.to);
  if (!/^[a-f0-9-]{36}$/.test(mail.id) || /[\r\n\0]/.test(mail.subject))
    throw new Error('INVALID_MAIL');
  const transport = smtpTransport(config);
  try {
    const pdf = Buffer.from(mail.pdfBase64, 'base64');
    if (
      pdf.length > 10_000_000 ||
      pdf.subarray(0, 5).toString() !== '%PDF-' ||
      !/^[A-Za-z0-9_-]+\.pdf$/.test(mail.filename)
    )
      throw new Error('INVALID_PDF_ATTACHMENT');
    const result = await transport.sendMail({
      from: { address: config.from, name: config.fromName },
      to: { address: mail.to, name: '' },
      replyTo: config.replyTo,
      subject: mail.subject,
      attachments: [
        {
          filename: mail.filename,
          content: pdf,
          contentType: 'application/pdf',
        },
      ],
      messageId: `<reservation-${mail.id}@${config.from.split('@')[1]}>`,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    if (result.accepted.length !== 1 || result.rejected.length)
      throw Object.assign(new Error('RECIPIENT_REJECTED'), {
        responseCode: 550,
      });
    return { messageId: result.messageId };
  } finally {
    transport.close();
  }
}

/** Only retry explicit pre-DATA failures or explicit temporary SMTP rejections.
 * Timeouts/disconnects during DATA may already have delivered: never blind-retry.
 */
export function mailFailure(error: unknown): 'RETRY' | 'FAILED' | 'UNKNOWN' {
  const e = error as {
    code?: string;
    command?: string;
    responseCode?: number;
  } | null;
  if (e?.responseCode && e.responseCode >= 400 && e.responseCode < 500)
    return 'RETRY';
  if (e?.responseCode && e.responseCode >= 500) return 'FAILED';
  if (e?.code === 'EAUTH' || e?.code === 'EENVELOPE') return 'FAILED';
  if (['EDNS', 'ECONNECTION'].includes(e?.code ?? '') && e?.command !== 'DATA')
    return 'RETRY';
  return 'UNKNOWN';
}
