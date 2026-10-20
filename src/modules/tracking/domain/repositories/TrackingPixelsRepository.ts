import type { TrackingPixel } from '../entities/TrackingPixel';

export const TRACKING_PIXELS_REPOSITORY = Symbol('TRACKING_PIXELS_REPOSITORY');

export interface TrackingPixelsRepository {
  findByExpert(
    tenantId: string,
    expertId: string,
  ): Promise<TrackingPixel | null>;
  /**
   * Cria o pixel do expert. Se outro pedido criou ao mesmo tempo, devolve o
   * que ficou gravado (um pixel por expert).
   */
  createForExpert(pixel: TrackingPixel): Promise<TrackingPixel>;
  findByPublicKey(publicKey: string): Promise<TrackingPixel | null>;
  /** Marca que chegou evento; grava no máximo uma vez por minuto. */
  touchLastEvent(pixelId: string): Promise<void>;
  /** Acrescenta o domínio se ainda não estiver na lista; devolve o pixel atualizado. */
  addAllowedDomain(pixelId: string, domain: string): Promise<TrackingPixel>;
}
