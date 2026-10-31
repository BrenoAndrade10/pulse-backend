import { Injectable } from '@nestjs/common';
import { PixelConfigProvider } from './PixelConfigProvider';

const canonicalPage = (url: string): string =>
  url.toLowerCase().replace('://www.', '://').replace(/\/+$/, '');

export type PublicPixelConfig = {
  rules: {
    id: string;
    scope: 'page' | 'site';
    pageUrl: string;
    trigger: 'click' | 'submit';
    selector: string;
    fields: { slug: string; key: string; selector: string }[];
  }[];
};

/**
 * Regras que o script do pixel baixa para a página aberta: as do site todo e
 * as daquela página. Públicas (vão para o navegador de qualquer visitante):
 * só o necessário para reconhecer elementos e campos.
 */
@Injectable()
export class GetPixelConfigUseCase {
  constructor(private readonly configs: PixelConfigProvider) {}

  async execute(
    publicKey: string,
    page?: string,
  ): Promise<PublicPixelConfig | null> {
    const config = await this.configs.get(publicKey);
    if (!config) return null;

    const target = page ? canonicalPage(page.slice(0, 2048)) : null;
    return {
      rules: config.rules
        .filter(
          (rule) =>
            rule.scope === 'site' ||
            (target !== null && canonicalPage(rule.pageUrl) === target),
        )
        .map((rule) => ({
          id: rule.id,
          scope: rule.scope,
          pageUrl: rule.pageUrl,
          trigger: rule.trigger,
          selector: rule.element.selector,
          fields: rule.fields.map((field) => ({
            slug: field.slug,
            key: field.key,
            selector: field.selector,
          })),
        })),
    };
  }
}
