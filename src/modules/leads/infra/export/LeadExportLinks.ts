import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Environment } from '../../../../config/Environment';

export const EXPORT_DOWNLOAD_PATH = '/leads/exports/download';
const TTL_SECONDS = 5 * 60;

export type LeadExportGrant = {
  tenantId: string;
  expertId: string;
  launchId: string | null;
  userId: string;
  /** Segundos desde 1970. */
  exp: number;
};

/**
 * Link de download do CSV. O navegador baixa direto (streaming, sem guardar
 * o arquivo na memória da página), e um link comum não leva o token de
 * login: por isso ele é assinado, vale 5 minutos e só para aquele filtro.
 */
@Injectable()
export class LeadExportLinks {
  sign(grant: Omit<LeadExportGrant, 'exp'>, now = Date.now()): string {
    const payload = Buffer.from(
      JSON.stringify({ ...grant, exp: Math.floor(now / 1000) + TTL_SECONDS }),
      'utf8',
    ).toString('base64url');
    const params = new URLSearchParams({
      p: payload,
      s: this.signature(payload),
    });
    return `${EXPORT_DOWNLOAD_PATH}?${params}`;
  }

  verify(
    payload: unknown,
    signature: unknown,
    now = Date.now(),
  ): LeadExportGrant | null {
    if (typeof payload !== 'string' || typeof signature !== 'string')
      return null;

    const expected = Buffer.from(this.signature(payload), 'base64url');
    const received = Buffer.from(signature, 'base64url');
    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    ) {
      return null;
    }

    try {
      const grant = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      ) as LeadExportGrant;
      return typeof grant.exp === 'number' && grant.exp * 1000 >= now
        ? grant
        : null;
    } catch {
      return null;
    }
  }

  private signature(payload: string): string {
    Environment.assertInitialized();
    const key = createHmac('sha256', Environment.vars.JWT_SECRET)
      .update('leads-export:v1')
      .digest();
    return createHmac('sha256', key).update(payload).digest('base64url');
  }
}
