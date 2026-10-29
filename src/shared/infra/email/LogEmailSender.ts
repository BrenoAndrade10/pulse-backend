import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { EmailSender, SendEmailInput } from '../../domain/EmailSender';

@Injectable()
export class LogEmailSender implements EmailSender, OnModuleInit {
  private readonly logger = new Logger(LogEmailSender.name);

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'production') {
      this.logger.error(
        'EMAIL_PROVIDER_NOT_CONFIGURED: recuperação de senha inoperante',
      );
    }
  }

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
