import { LinkChannel } from '../../domain/enums/LinkChannel';
import { LinkUtmBuilder } from './LinkUtmBuilder';

describe('LinkUtmBuilder', () => {
  const builder = new LinkUtmBuilder();

  it.each([
    [LinkChannel.INSTAGRAM, 'instagram', 'social'],
    [LinkChannel.WHATSAPP, 'whatsapp', 'message'],
    [LinkChannel.TELEGRAM, 'telegram', 'message'],
    [LinkChannel.EMAIL, 'email', 'email'],
    [LinkChannel.ADS, 'ads', 'paid'],
    [LinkChannel.OTHER, 'other', 'link'],
  ])('builds defaults for %s', (channel, source, medium) => {
    expect(builder.build({ channel })).toMatchObject({
      source,
      medium,
      campaign: null,
      content: null,
      term: null,
    });
  });

  it('uses catalog placement as medium and link name as content', () => {
    expect(
      builder.build({
        channel: LinkChannel.INSTAGRAM,
        placement: 'stories',
        linkName: 'Página de Oferta',
      }),
    ).toEqual({
      source: 'instagram',
      medium: 'stories',
      campaign: null,
      content: 'pagina-de-oferta',
      term: null,
    });
  });

  it('uses a custom placement slug as medium', () => {
    expect(
      builder.build({
        channel: LinkChannel.WHATSAPP,
        placement: 'Grupo VIP 2026',
      }),
    ).toMatchObject({ source: 'whatsapp', medium: 'grupo-vip-2026' });
  });

  it('falls back to launch name for campaign', () => {
    expect(
      builder.build({
        channel: LinkChannel.EMAIL,
        launchName: 'Lançamento de Outubro',
      }),
    ).toMatchObject({ campaign: 'lancamento-de-outubro' });
  });

  it('uses campaign before launch name and applies overrides', () => {
    expect(
      builder.build({
        channel: LinkChannel.TELEGRAM,
        campaign: 'Campanha Original',
        launchName: 'Lançamento',
        linkName: 'Botão 1',
        overrides: {
          source: 'Minha Fonte',
          medium: 'VIP',
          campaign: 'Oferta',
          content: 'CTA',
          term: 'Plano A',
        },
      }),
    ).toEqual({
      source: 'minha-fonte',
      medium: 'vip',
      campaign: 'oferta',
      content: 'cta',
      term: 'plano-a',
    });
  });

  it('returns null for empty optional values and truncates to 120 characters', () => {
    const value = 'a'.repeat(150);
    expect(
      builder.build({
        channel: LinkChannel.OTHER,
        campaign: '---',
        linkName: '',
        placement: '',
        overrides: { term: '   ', source: value },
      }),
    ).toEqual({
      source: value.slice(0, 120),
      medium: 'link',
      campaign: null,
      content: null,
      term: null,
    });
  });
});
