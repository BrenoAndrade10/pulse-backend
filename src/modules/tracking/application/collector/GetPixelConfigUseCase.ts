import { Injectable } from '@nestjs/common';
import { PixelConfigProvider } from './PixelConfigProvider';

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
 * Regras que o script do pixel baixa. Públicas (vão para o navegador de
 * qualquer visitante): só o necessário para reconhecer elementos e campos.
 */
@Injectable()
export class GetPixelConfigUseCase {
  constructor(private readonly configs: PixelConfigProvider) {}

  async execute(publicKey: string): Promise<PublicPixelConfig | null> {
    const config = await this.configs.get(publicKey);
    if (!config) return null;

    return {
      rules: config.rules.map((rule) => ({
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
