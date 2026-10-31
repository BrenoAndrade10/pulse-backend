import type { TrackingRule } from '../../../domain/entities/TrackingRule';
import { GetPixelConfigUseCase } from '../GetPixelConfigUseCase';
import type { PixelConfigProvider } from '../PixelConfigProvider';

const rule = (id: string, scope: 'page' | 'site', pageUrl: string) =>
  ({
    id,
    scope,
    pageUrl,
    trigger: 'click',
    element: { selector: '#cta', tag: 'a', attributes: {} },
    fields: [],
  }) as unknown as TrackingRule;

describe('GetPixelConfigUseCase', () => {
  const rules = [
    rule('site', 'site', 'https://meusite.com.br/'),
    rule('captura', 'page', 'https://www.meusite.com.br/captura/'),
    rule('oferta', 'page', 'https://meusite.com.br/oferta-secreta'),
  ];
  const configs = {
    get: jest.fn().mockResolvedValue({ rules }),
  };
  const useCase = new GetPixelConfigUseCase(
    configs as unknown as PixelConfigProvider,
  );
  const ids = async (page?: string) =>
    (await useCase.execute('PX_abcdefghijklmnopqrst', page))?.rules.map(
      (item) => item.id,
    );

  it('returns the site rules and the rules of the requested page', async () => {
    await expect(ids('https://meusite.com.br/Captura')).resolves.toEqual([
      'site',
      'captura',
    ]);
  });

  it('returns only the site rules without a page', async () => {
    await expect(ids()).resolves.toEqual(['site']);
  });

  it('returns null for an unknown pixel', async () => {
    configs.get.mockResolvedValueOnce(null);

    await expect(
      useCase.execute('PX_abcdefghijklmnopqrst', 'https://meusite.com.br/'),
    ).resolves.toBeNull();
  });
});
