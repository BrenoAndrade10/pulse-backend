import {
  findMatchingKeyword,
  normalizeKeyword,
  uniqueKeywords,
} from './commentKeywords';

describe('commentKeywords', () => {
  it('normalizes case, accents and spaces', () => {
    expect(normalizeKeyword('  Quero   o LÍNK ')).toBe('quero o link');
  });

  it('removes empty and repeated keywords, keeping the typed spelling', () => {
    expect(
      uniqueKeywords(['Eu quero', 'eu  QUERO', ' ', 'Link', 'línk']),
    ).toEqual(['Eu quero', 'Link']);
  });

  it.each([
    ['QUERO!!!', 'quero'],
    ['eu quéro muito', 'quero'],
    ['Manda o link, por favor', 'link'],
    ['quero 🙏', 'quero'],
    ['#quero', 'quero'],
  ])('matches %p', (comment, expected) => {
    expect(findMatchingKeyword(comment, ['quero', 'link'])).toBe(expected);
  });

  it.each([['querosene acabou'], ['linkedin'], ['nada a ver'], ['']])(
    'does not match %p',
    (comment) => {
      expect(findMatchingKeyword(comment, ['quero', 'link'])).toBeNull();
    },
  );

  it('matches multi-word keywords as a phrase', () => {
    expect(findMatchingKeyword('Eu QUERO o link!', ['quero o link'])).toBe(
      'quero o link',
    );
    expect(findMatchingKeyword('quero agora o link', ['quero o link'])).toBe(
      null,
    );
  });

  it('returns the first keyword in the configured order', () => {
    expect(findMatchingKeyword('link quero', ['quero', 'link'])).toBe('quero');
  });
});
