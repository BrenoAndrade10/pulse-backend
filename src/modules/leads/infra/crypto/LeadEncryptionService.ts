import { Injectable } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'node:crypto';
import { Environment } from '../../../../config/Environment';
import { DomainError } from '../../../../shared/errors/DomainError';
import { parseAes256Key } from '../../../../shared/infra/crypto/parseAes256Key';
import type { LeadCipher, LeadOwner } from '../../domain/services/LeadCipher';
import type {
  EncryptedProfile,
  LeadProfile,
} from '../../domain/types/LeadProfile';

const ALGORITHM = 'aes-256-gcm';

/**
 * Cifra os dados dos leads com uma chave só deles (LEADS_ENCRYPTION_KEY),
 * separada da dos tokens da Meta. Da mesma chave saem duas subchaves com
 * rótulos diferentes: uma cifra, outra só faz o HMAC de identificação.
 */
@Injectable()
export class LeadEncryptionService implements LeadCipher {
  private cached: {
    source: string;
    encryption: Buffer;
    hashing: Buffer;
  } | null = null;

  assertConfigured(): void {
    this.keys();
  }

  encrypt(profile: LeadProfile, owner: LeadOwner): EncryptedProfile {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.keys().encryption, iv);
    cipher.setAAD(this.aad(owner));
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(profile), 'utf8'),
      cipher.final(),
    ]);

    return {
      encryptedValue: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
    };
  }

  decrypt(profile: EncryptedProfile, owner: LeadOwner): LeadProfile {
    try {
      const decipher = createDecipheriv(
        ALGORITHM,
        this.keys().encryption,
        Buffer.from(profile.iv, 'base64'),
      );
      decipher.setAAD(this.aad(owner));
      decipher.setAuthTag(Buffer.from(profile.authTag, 'base64'));
      const json = Buffer.concat([
        decipher.update(Buffer.from(profile.encryptedValue, 'base64')),
        decipher.final(),
      ]).toString('utf8');

      return JSON.parse(json) as LeadProfile;
    } catch {
      throw new DomainError(500, 'LEAD_DECRYPTION_FAILED');
    }
  }

  hash(kind: 'email' | 'phone', value: string): string {
    return createHmac('sha256', this.keys().hashing)
      .update(`${kind}:${value}`)
      .digest('hex');
  }

  /** O lead só decifra no próprio registro (copiar o blob para outro não funciona). */
  private aad(owner: LeadOwner): Buffer {
    return Buffer.from(
      `lead:v1:${owner.tenantId}:${owner.expertId}:${owner.leadId}`,
      'utf8',
    );
  }

  private keys() {
    Environment.assertInitialized();
    const source = Environment.vars.LEADS_ENCRYPTION_KEY;

    if (!source) {
      throw new DomainError(503, 'LEADS_ENCRYPTION_KEY_NOT_CONFIGURED');
    }
    if (this.cached?.source === source) return this.cached;

    const key = parseAes256Key(source);
    if (!key) throw new DomainError(500, 'LEADS_ENCRYPTION_KEY_INVALID');

    this.cached = {
      source,
      encryption: createHmac('sha256', key)
        .update('leads-encryption:v1')
        .digest(),
      hashing: createHmac('sha256', key).update('leads-hash:v1').digest(),
    };
    return this.cached;
  }
}
