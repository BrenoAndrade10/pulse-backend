import { Injectable } from '@nestjs/common';
import Handlebars from 'handlebars';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Environment } from '../../../../config/Environment';

export type RenderedEmail = {
  html: string;
  text: string;
};

@Injectable()
export class EmailTemplateRenderer {
  private readonly templates = new Map<string, Handlebars.TemplateDelegate>();

  render(
    name: 'password-reset' | 'password-changed' | 'login-code',
    data: Record<string, unknown>,
  ): RenderedEmail {
    const content = this.template(`${name}.html.hbs`)(data);
    const html = this.template('layout.html.hbs')({
      title: data.title,
      logoUrl: this.logoUrl(),
      content: new Handlebars.SafeString(content),
    });
    const text = this.template(`${name}.text.hbs`)(data);

    return { html, text };
  }

  private logoUrl(): string | undefined {
    const apiPublicUrl = Environment.vars?.API_PUBLIC_URL?.trim();
    return apiPublicUrl
      ? new URL('/assets/brand/pulse-logo.png', apiPublicUrl).toString()
      : undefined;
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
