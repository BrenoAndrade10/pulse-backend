import { normalizePageUrl } from './pageUrl';

describe('normalizePageUrl', () => {
  it('keeps the page and drops the fragment', () => {
    expect(
      normalizePageUrl(' https://www.Meusite.com.br/vendas?utm=x#oferta '),
    ).toEqual({
      url: 'https://www.meusite.com.br/vendas?utm=x',
      page: 'https://www.meusite.com.br/vendas',
      domain: 'meusite.com.br',
    });
  });

  it.each([
    ['http', 'http://meusite.com.br'],
    ['javascript', 'javascript:alert(1)'],
    ['localhost', 'https://localhost:5173'],
    ['ip', 'https://192.168.0.10/pagina'],
    ['ipv6', 'https://[::1]/pagina'],
    ['local domain', 'https://loja.local'],
    ['credentials', 'https://user:pass@meusite.com.br'],
    ['garbage', 'não é um link'],
  ])('refuses %s', (_, input) => {
    expect(normalizePageUrl(input)).toBeNull();
  });

  it('accepts localhost only when local pages are allowed', () => {
    expect(normalizePageUrl('http://localhost:5174/demo')).toBeNull();
    expect(
      normalizePageUrl('http://localhost:5174/demo?x=1', { allowLocal: true }),
    ).toEqual({
      url: 'http://localhost:5174/demo?x=1',
      page: 'http://localhost:5174/demo',
      domain: 'localhost',
    });
    expect(
      normalizePageUrl('http://192.168.0.10/demo', { allowLocal: true }),
    ).toBeNull();
  });
});
