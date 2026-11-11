import { CryptoLinkCodeGenerator } from './CryptoLinkCodeGenerator';

const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';

function randomFor(value: string): (_max: number) => number {
  const indexes = [...value].map((character) => ALPHABET.indexOf(character));
  let position = 0;

  return () => indexes[position++ % indexes.length];
}

describe('CryptoLinkCodeGenerator', () => {
  it('generates codes with the default and custom lengths', () => {
    const generator = new CryptoLinkCodeGenerator(() => 0);

    expect(generator.generate()).toHaveLength(8);
    expect(generator.generate(12)).toHaveLength(12);
  });

  it('uses only the allowed lowercase alphabet and migration-compatible format', () => {
    const generator = new CryptoLinkCodeGenerator();
    const code = generator.generate(16);

    expect(code).toMatch(/^[a-z0-9]{7,16}$/);
    expect([...code].every((character) => ALPHABET.includes(character))).toBe(
      true,
    );
  });

  it.each([6, 17, 6.5, Number.NaN])('rejects invalid length %s', (length) => {
    const generator = new CryptoLinkCodeGenerator();

    expect(() => generator.generate(length)).toThrow(RangeError);
  });

  it('does not return blocked terms', () => {
    const generator = new CryptoLinkCodeGenerator(randomFor('testing'));

    expect(() => generator.generate(7)).toThrow(Error);
  });

  it('retries blocked codes and returns the next valid code', () => {
    const values = [...'testing2abcdef'];
    let position = 0;
    const generator = new CryptoLinkCodeGenerator(() => {
      const value = values[position++];
      return ALPHABET.indexOf(value);
    });

    expect(generator.generate(7)).toBe('2abcdef');
  });

  it('keeps the character distribution approximately uniform', () => {
    const generator = new CryptoLinkCodeGenerator();
    const counts = new Map(
      ALPHABET.split('').map((character) => [character, 0]),
    );

    for (let index = 0; index < 4000; index += 1) {
      for (const character of generator.generate(8)) {
        counts.set(character, (counts.get(character) ?? 0) + 1);
      }
    }

    const values = [...counts.values()];
    expect(Math.min(...values)).toBeGreaterThan(700);
    expect(Math.max(...values)).toBeLessThan(1_400);
  });
});
