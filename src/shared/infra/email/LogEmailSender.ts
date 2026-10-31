import { Injectable, Logger } from '@nestjs/common';
import type { EmailSender, SendEmailInput } from '../../domain/EmailSender';

@Injectable()
export class LogEmailSender implements EmailSender {
  private readonly logger = new Logger(LogEmailSender.name);

  send(input: SendEmailInput): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      return Promise.resolve();
    }

    this.logger.log(
      `E-mail para: ${input.to}\nAssunto: ${input.subject}\n${input.text}`,
    );
    return Promise.resolve();
  }
}
