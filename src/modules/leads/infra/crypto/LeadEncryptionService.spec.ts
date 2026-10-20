import { randomBytes } from 'node:crypto';
import { Environment } from '../../../../config/Environment';
import { LeadEncryptionService } from './LeadEncryptionService';

describe('LeadEncryptionService', () => {
  const owner = {
    tenantId: 'tenant-a',
    expertId: 'expert-a',
    leadId: 'lead-a',
  };
  const profile = {
    name: 'Ana',
    email: 'ana@exemplo.com',
    phone: '+5511999998888',
    custom: { Origem: 'Instagram' },
  };
  let service: LeadEncryptionService;

  const reasonOf = (fn: () => unknown) => {
    try {
      fn();
    } catch (error) {
      return (error as { reason?: string }).reason;
    }
    return null;
  };

  beforeEach(() => {
    Environment.vars = {
      LEADS_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    } as typeof Environment.vars;
    service = new LeadEncryptionService();
  });

  it('encrypts the profile and decrypts it only on the same lead', () => {
    const encrypted = service.encrypt(profile, owner);

    expect(encrypted.encryptedValue).not.toContain('ana@exemplo.com');
    expect(service.decrypt(encrypted, owner)).toEqual(profile);
    expect(
      reasonOf(() =>
        service.decrypt(encrypted, { ...owner, leadId: 'lead-b' }),
      ),
    ).toBe('LEAD_DECRYPTION_FAILED');
    expect(
      reasonOf(() =>
        service.decrypt(encrypted, { ...owner, tenantId: 'tenant-b' }),
      ),
    ).toBe('LEAD_DECRYPTION_FAILED');
  });

  it('hashes with a secret key, separating email and phone', () => {
    const hash = service.hash('email', 'ana@exemplo.com');

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(service.hash('email', 'ana@exemplo.com')).toBe(hash);
    expect(service.hash('phone', 'ana@exemplo.com')).not.toBe(hash);

    // Outra chave, outro hash: sem a chave não dá para testar e-mails conhecidos.
    Environment.vars.LEADS_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    expect(service.hash('email', 'ana@exemplo.com')).not.toBe(hash);
  });

  it('refuses to work without the key', () => {
    Environment.vars.LEADS_ENCRYPTION_KEY = undefined;

    expect(reasonOf(() => service.assertConfigured())).toBe(
      'LEADS_ENCRYPTION_KEY_NOT_CONFIGURED',
    );
  });
});
