import { Injectable } from '@nestjs/common';
import { Environment } from '../../../config/Environment';
import type { EmailSender, SendEmailInput } from '../../domain/EmailSender';

const BRAND_NAME = 'Pulse Lead';
const DEFAULT_FROM = 'no-reply@usepulselead.com';

function sender(configured: string | undefined): string {
  const value = configured?.trim() || DEFAULT_FROM;
  return value.includes('<') ? value : `${BRAND_NAME} <${value}>`;
}

@Injectable()
export class ResendEmailSender implements EmailSender {
  async send(input: SendEmailInput): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Environment.vars.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: sender(Environment.vars.EMAIL_FROM),
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        attachments: input.inlineImages?.map((image) => ({
          filename: image.filename,
          content: image.base64,
          content_type: image.contentType,
          content_id: image.contentId,
        })),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`RESEND_HTTP_${response.status}`);
  }
}
