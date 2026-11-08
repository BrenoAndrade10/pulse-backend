export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

export type InlineImage = {
  contentId: string;
  filename: string;
  contentType: string;
  base64: string;
};

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  inlineImages?: InlineImage[];
};

export interface EmailSender {
  send(input: SendEmailInput): Promise<void>;
}
