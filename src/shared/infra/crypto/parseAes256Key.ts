const BASE64_KEY = /^[A-Za-z0-9+/]{43}=$/;
const HEX_KEY = /^[0-9a-fA-F]{64}$/;

/**
 * Lê uma chave AES-256 de exatamente 32 bytes, em base64 (44 caracteres) ou
 * hex (64 caracteres). Qualquer outro formato é recusado: senhas comuns não
 * podem virar chave.
 */
export function parseAes256Key(value: string): Buffer | null {
  const key = value.trim();

  if (BASE64_KEY.test(key)) return Buffer.from(key, 'base64');
  if (HEX_KEY.test(key)) return Buffer.from(key, 'hex');

  return null;
}
