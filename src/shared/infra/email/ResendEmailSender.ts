import { Injectable } from '@nestjs/common';
import { Environment } from '../../../config/Environment';
import type { EmailSender, SendEmailInput } from '../../domain/EmailSender';

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
        from:
          Environment.vars.EMAIL_FROM ??
          'Pulse Lead <no-reply@usepulselead.com>',
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`RESEND_HTTP_${response.status}`);
  }
}
