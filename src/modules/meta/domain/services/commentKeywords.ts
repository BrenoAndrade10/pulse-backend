export const MAX_KEYWORDS = 10;
export const MAX_KEYWORD_LENGTH = 50;
/** Limite de texto de uma mensagem no Direct do Instagram. */
export const MAX_REPLY_MESSAGE_LENGTH = 1000;
/** Com botão a DM vira template, que aceita menos texto. */
export const MAX_BUTTON_MESSAGE_LENGTH = 640;
/** Limite de título de botão da Meta. */
export const MAX_BUTTON_LABEL_LENGTH = 20;
export const MAX_BUTTON_URL_LENGTH = 2000;
/** Limite de um comentário no Instagram. */
export const MAX_COMMENT_REPLY_LENGTH = 2200;

/** Minúsculas, sem acentos e com espaços simples: "  Quero  o LINK " → "quero o link". */
export function normalizeKeyword(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Remove vazias e repetidas (ignorando maiúsculas e acentos), mantendo a grafia digitada. */
export function uniqueKeywords(keywords: string[]): string[] {
  const seen = new Set<string>();

  return keywords
    .map((keyword) => keyword.replace(/\s+/g, ' ').trim())
    .filter((keyword) => {
      const normalized = normalizeKeyword(keyword);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
}

/**
 * Primeira palavra-chave presente no comentário como palavra inteira
 * ("quero" não casa com "querosene"), ignorando maiúsculas e acentos.
 */
export function findMatchingKeyword(
  comment: string,
  keywords: string[],
): string | null {
  const text = ` ${normalizeKeyword(comment).replace(/[^\p{L}\p{N}]+/gu, ' ')} `;

  for (const keyword of keywords) {
    const normalized = normalizeKeyword(keyword)
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();

    if (normalized && text.includes(` ${normalized} `)) return keyword;
  }

  return null;
}
