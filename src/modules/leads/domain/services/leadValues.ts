import type { LeadProfile } from '../types/LeadProfile';

export const MAX_FIELD_VALUE_LENGTH = 500;
export const MAX_CUSTOM_FIELDS = 20;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** E-mail em minúsculas; `null` se não parece um e-mail. */
export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}

/**
 * Telefone no formato internacional (E.164). Sem código do país, assume o
 * Brasil (+55), que é o caso de quase todos os formulários dos clientes.
 */
export function normalizePhone(value: string): string | null {
  const international = value.trim().startsWith('+');
  let digits = value.replace(/\D/g, '');
  if (!international) digits = digits.replace(/^0+/, '');

  if (!international && (digits.length === 10 || digits.length === 11)) {
    digits = `55${digits}`;
  }

  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
}

export function normalizeText(value: string): string | null {
  const text = value
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_FIELD_VALUE_LENGTH);
  return text || null;
}

/**
 * Junta o que chegou agora com o que o lead já tinha: valores novos
 * atualizam, campos que não vieram neste envio continuam como estavam.
 */
export function mergeProfiles(
  current: LeadProfile | null,
  incoming: LeadProfile,
): LeadProfile {
  const custom = { ...(current?.custom ?? {}), ...incoming.custom };
  const limited = Object.fromEntries(
    Object.entries(custom).slice(0, MAX_CUSTOM_FIELDS),
  );

  return {
    name: incoming.name ?? current?.name,
    email: incoming.email ?? current?.email,
    phone: incoming.phone ?? current?.phone,
    custom: limited,
  };
}
