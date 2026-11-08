export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export interface EmailSender {
  send(input: SendEmailInput): Promise<void>;
}
