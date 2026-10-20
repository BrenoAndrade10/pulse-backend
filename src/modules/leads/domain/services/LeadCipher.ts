import type { EncryptedProfile, LeadProfile } from '../types/LeadProfile';

export const LEAD_CIPHER = Symbol('LEAD_CIPHER');

export type LeadOwner = { tenantId: string; expertId: string; leadId: string };

export interface LeadCipher {
  /** Lança erro se a chave dos leads não estiver configurada. */
  assertConfigured(): void;
  encrypt(profile: LeadProfile, owner: LeadOwner): EncryptedProfile;
  decrypt(profile: EncryptedProfile, owner: LeadOwner): LeadProfile;
  /** HMAC do e-mail ou telefone já normalizado: reconhece a pessoa sem decifrar. */
  hash(kind: 'email' | 'phone', value: string): string;
}
