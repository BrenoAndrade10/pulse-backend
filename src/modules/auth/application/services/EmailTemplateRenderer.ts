import { Injectable } from '@nestjs/common';
import Handlebars from 'handlebars';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { InlineImage } from '../../../../shared/domain/EmailSender';

export type RenderedEmail = {
  html: string;
  text: string;
  inlineImages: InlineImage[];
};

const LOGO_CONTENT_ID = 'pulse-logo';

@Injectable()
export class EmailTemplateRenderer {
  private readonly templates = new Map<string, Handlebars.TemplateDelegate>();
  private logo?: InlineImage;

  render(
    name: 'password-reset' | 'password-changed' | 'login-code',
    data: Record<string, unknown>,
  ): RenderedEmail {
    const content = this.template(`${name}.html.hbs`)(data);
    const html = this.template('layout.html.hbs')({
      title: data.title,
      logoCid: LOGO_CONTENT_ID,
      content: new Handlebars.SafeString(content),
    });
    const text = this.template(`${name}.text.hbs`)(data);

    return { html, text, inlineImages: [this.logoImage()] };
  }

  private logoImage(): InlineImage {
    this.logo ??= {
      contentId: LOGO_CONTENT_ID,
      filename: 'pulse-logo.png',
      contentType: 'image/png',
      base64: readFileSync(
        join(__dirname, 'templates', 'pulse-logo.png'),
      ).toString('base64'),
    };
    return this.logo;
  }

  private template(fileName: string): Handlebars.TemplateDelegate {
    let compiled = this.templates.get(fileName);
    if (!compiled) {
      const source = readFileSync(
        join(__dirname, 'templates', fileName),
        'utf8',
      );
      compiled = Handlebars.compile(source);
      this.templates.set(fileName, compiled);
    }
    return compiled;
  }
}
