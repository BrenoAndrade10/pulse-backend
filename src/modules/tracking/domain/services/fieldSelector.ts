const SECRET =
  /senha|password|passwd|pin\b|cart[aã]o|card|cvv|cvc|security|seguran[cç]a/i;
const ESCAPE = String.raw`\\[0-9a-fA-F]{1,6} ?|\\[^0-9a-fA-F]`;
const BY_ATTRIBUTE = new RegExp(
  String.raw`^(?:input|select|textarea)?\[(?:name|placeholder)="((?:[^"\\]|${ESCAPE})*)"\]$`,
);
const BY_ID = new RegExp(String.raw`^#((?:[\w-]|${ESCAPE})+)$`);

const unescape = (value: string): string =>
  value
    .replace(/\\([0-9a-fA-F]{1,6}) ?/g, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/\\(.)/g, '$1');

export function isSafeFieldSelector(selector: string | undefined): boolean {
  const match = selector
    ? (BY_ATTRIBUTE.exec(selector) ?? BY_ID.exec(selector))
    : null;
  return match !== null && !SECRET.test(unescape(match[1]));
}

export function isSafeFieldLabel(label: string | undefined): boolean {
  return !label || !SECRET.test(label);
}
