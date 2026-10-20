import { randomBytes, randomInt } from 'node:crypto';

const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** `PX_` + 20 caracteres sorteados de forma uniforme. */
export function generatePixelKey(): string {
  let key = 'PX_';
  for (let i = 0; i < 20; i++) key += ALPHABET[randomInt(ALPHABET.length)];
  return key;
}

/** Token do modo de configuração: 256 bits, seguro para ir na URL. */
export function generateSetupToken(): string {
  return randomBytes(32).toString('base64url');
}
