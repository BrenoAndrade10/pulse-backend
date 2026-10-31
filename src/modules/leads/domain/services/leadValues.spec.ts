import {
  mergeProfiles,
  normalizeEmail,
  normalizePhone,
  normalizeText,
} from './leadValues';

describe('leadValues', () => {
  it.each([
    [' Ana@Exemplo.COM ', 'ana@exemplo.com'],
    ['nao-e-email', null],
    ['ana@exemplo', null],
  ])('normalizes the email %p', (input, expected) => {
    expect(normalizeEmail(input)).toBe(expected);
  });

  it.each([
    ['(11) 99999-8888', '+5511999998888'],
    ['11 3333-4444', '+551133334444'],
    ['011 99999-8888', '+5511999998888'],
    ['+351 912 345 678', '+351912345678'],
    ['5511999998888', '+5511999998888'],
    ['123', null],
  ])('normalizes the phone %p', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it('collapses spaces and drops empty text', () => {
    expect(normalizeText('  Ana   Souza ')).toBe('Ana Souza');
    expect(normalizeText('   ')).toBeNull();
  });

  it('keeps what the lead already has and only fills empty fields', () => {
    expect(
      mergeProfiles(
        {
          name: 'Ana',
          email: 'ana@exemplo.com',
          phone: '+5511999998888',
          custom: { Origem: 'Instagram' },
        },
        {
          name: 'Atacante',
          phone: '+5511977776666',
          custom: { Origem: 'Anúncio', Faturamento: '10k' },
        },
      ),
    ).toEqual({
      name: 'Ana',
      email: 'ana@exemplo.com',
      phone: '+5511999998888',
      custom: { Origem: 'Instagram', Faturamento: '10k' },
    });
  });

  it('takes the incoming values for a new lead', () => {
    expect(
      mergeProfiles(null, {
        name: 'Ana',
        email: 'ana@exemplo.com',
        custom: {},
      }),
    ).toEqual({
      name: 'Ana',
      email: 'ana@exemplo.com',
      phone: undefined,
      custom: {},
    });
  });
});
