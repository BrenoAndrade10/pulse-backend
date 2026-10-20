import { Inject, Injectable } from '@nestjs/common';
import type { TrackingPixel } from '../../domain/entities/TrackingPixel';
import type { TrackingRule } from '../../domain/entities/TrackingRule';
import { TRACKING_PIXELS_REPOSITORY } from '../../domain/repositories/TrackingPixelsRepository';
import type { TrackingPixelsRepository } from '../../domain/repositories/TrackingPixelsRepository';
import { TRACKING_RULES_REPOSITORY } from '../../domain/repositories/TrackingRulesRepository';
import type { TrackingRulesRepository } from '../../domain/repositories/TrackingRulesRepository';
import { MemoryCache } from '../../infra/collector/MemoryCache';

export const PIXEL_KEY_PATTERN = /^PX_[A-Za-z0-9]{20}$/;

export type PixelConfig = {
  pixel: TrackingPixel;
  rules: TrackingRule[];
  rulesById: Map<string, TrackingRule>;
};

/**
 * Pixel e regras pela chave pública, em cache por 30 s: são lidos a cada
 * evento de todas as visitas. Uma regra nova vale em até ~1 minuto (este
 * cache + o do navegador).
 */
@Injectable()
export class PixelConfigProvider {
  private readonly cache = new MemoryCache<PixelConfig | null>(30_000);

  constructor(
    @Inject(TRACKING_PIXELS_REPOSITORY)
    private readonly pixels: TrackingPixelsRepository,

    @Inject(TRACKING_RULES_REPOSITORY)
    private readonly rules: TrackingRulesRepository,
  ) {}

  get(publicKey: string): Promise<PixelConfig | null> {
    if (!PIXEL_KEY_PATTERN.test(publicKey)) return Promise.resolve(null);

    return this.cache.get(publicKey, async () => {
      const pixel = await this.pixels.findByPublicKey(publicKey);
      if (!pixel) return null;

      const rules = await this.rules.findByPixel(pixel.id);
      return {
        pixel,
        rules,
        rulesById: new Map(rules.map((rule) => [rule.id, rule])),
      };
    });
  }
}
