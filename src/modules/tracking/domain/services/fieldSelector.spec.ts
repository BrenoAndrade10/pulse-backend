import { isSafeFieldLabel, isSafeFieldSelector } from './fieldSelector';

describe('fieldSelector', () => {
  it.each([
    'input[name="email"]',
    'select[placeholder="Estado"]',
    '[name="nome"]',
    'input[name="first\\"name"]',
    '#telefone',
    '#\\31 23',
  ])('accepts the selector %p', (selector) => {
    expect(isSafeFieldSelector(selector)).toBe(true);
  });

  it.each([
    'input[type=password]',
    'input[type="password"]',
    '[autocomplete^="cc-"]',
    'form input:nth-child(3)',
    'input[name="email"], input[type="password"]',
    'input[name="email"] ~ input',
    'input[name="senha"]',
    'input[name="cardNumber"]',
    '#password',
    '#\\73 enha',
    '#\\70 assword',
    '',
    undefined,
  ])('refuses the selector %p', (selector) => {
    expect(isSafeFieldSelector(selector)).toBe(false);
  });

  it('refuses sensitive labels', () => {
    expect(isSafeFieldLabel('Nome completo')).toBe(true);
    expect(isSafeFieldLabel('Número do cartão')).toBe(false);
    expect(isSafeFieldLabel('Senha')).toBe(false);
  });
});
