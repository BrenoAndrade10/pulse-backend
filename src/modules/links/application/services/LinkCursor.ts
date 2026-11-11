import { DomainError } from '../../../../shared/errors/DomainError';
import { isUuidV7 } from '../../../../shared/presentation/validators/isUuidV7';

export type LinkCursorValue = { createdAt: Date; id: string };
type EncodedCursor = { c: string; i: string };

export function encodeLinkCursor(value: LinkCursorValue): string {
  return Buffer.from(
    JSON.stringify({ c: value.createdAt.toISOString(), i: value.id }),
    'utf8',
  ).toString('base64url');
}

export function decodeLinkCursor(
  value: string | undefined,
): LinkCursorValue | undefined {
  if (!value) return undefined;
  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as Partial<EncodedCursor>;
    const date = typeof parsed.c === 'string' ? new Date(parsed.c) : null;
    if (
      !date ||
      Number.isNaN(date.getTime()) ||
      date.toISOString() !== parsed.c ||
      !isUuidV7(parsed.i ?? '')
    )
      throw new Error();
    if (encodeLinkCursor({ createdAt: date, id: parsed.i! }) !== value)
      throw new Error();
    return { createdAt: date, id: parsed.i! };
  } catch {
    throw DomainError.validationFailed({ errors: ['Cursor inválido.'] });
  }
}
