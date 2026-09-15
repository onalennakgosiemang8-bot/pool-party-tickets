import 'server-only';
import { env } from '../env';
import { prisma } from '../prisma';

export type Attachment = {
  filename: string;
  content: Buffer;
  contentType: string;
  cid?: string; // for inline images
};

export type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: string;
  ticketId?: string;
  attachments?: Attachment[];
};

/**
 * Transactional email. EMAIL_MODE=test sends nothing — it logs the message
 * to the console and to the EmailLog table so the flow is fully testable
 * without credentials. Failures never break a payment: a guest with a paid
 * ticket must always reach /success even if their email bounces.
 */
export async function sendEmail(args: SendArgs): Promise<{ sent: boolean; error?: string }> {
  const cfg = env.email();

  const log = await prisma.emailLog
    .create({
      data: {
        to: args.to,
        template: args.template,
        subject: args.subject,
        ticketId: args.ticketId ?? null,
        status: cfg.mode === 'test' ? 'test' : 'queued',
      },
    })
    .catch(() => null);

  if (cfg.mode === 'test' || !cfg.apiKey) {
    console.info(
      `\n──────── EMAIL (test mode — nothing sent) ────────\nTo: ${args.to}\nSubject: ${args.subject}\nTemplate: ${args.template}\nAttachments: ${
        args.attachments?.map((a) => a.filename).join(', ') || 'none'
      }\n\n${args.text}\n─────────────────────────────────────────────────\n`,
    );
    return { sent: false };
  }

  try {
    if (cfg.provider === 'resend') await sendViaResend(args, cfg);
    else await sendViaSendgrid(args, cfg);

    if (log) {
      await prisma.emailLog.update({ where: { id: log.id }, data: { status: 'sent' } });
    }
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown email error';
    console.error('Email send failed:', message);
    if (log) {
      await prisma.emailLog.update({
        where: { id: log.id },
        data: { status: 'failed', error: message.slice(0, 500) },
      });
    }
    return { sent: false, error: message };
  }
}

async function sendViaResend(args: SendArgs, cfg: ReturnType<typeof env.email>) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: cfg.from,
      to: [args.to],
      reply_to: cfg.replyTo || undefined,
      subject: args.subject,
      html: args.html,
      text: args.text,
      attachments: args.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content.toString('base64'),
        content_type: a.contentType,
        content_id: a.cid,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend responded ${response.status}: ${await response.text()}`);
  }
}

async function sendViaSendgrid(args: SendArgs, cfg: ReturnType<typeof env.email>) {
  const match = cfg.from.match(/^(.*)<(.+)>$/);
  const from = match
    ? { name: match[1].trim(), email: match[2].trim() }
    : { email: cfg.from.trim() };

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: args.to }] }],
      from,
      subject: args.subject,
      content: [
        { type: 'text/plain', value: args.text },
        { type: 'text/html', value: args.html },
      ],
      attachments: args.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content.toString('base64'),
        type: a.contentType,
        disposition: a.cid ? 'inline' : 'attachment',
        content_id: a.cid,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`SendGrid responded ${response.status}: ${await response.text()}`);
  }
}

export * from './templates';
