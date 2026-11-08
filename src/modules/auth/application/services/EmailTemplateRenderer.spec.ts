import { EmailTemplateRenderer } from './EmailTemplateRenderer';
import { Environment } from '../../../../config/Environment';

describe('EmailTemplateRenderer', () => {
  beforeEach(() => {
    Environment.vars = {} as typeof Environment.vars;
  });

  it('renders branded HTML and escapes user data', () => {
    const result = new EmailTemplateRenderer().render('password-changed', {
      title: 'Senha alterada',
      firstName: '<script>alert(1)</script>',
      changedAt: '21/10/2026 10:00',
    });

    expect(result.html).toContain('Pulse Lead');
    expect(result.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(result.html).not.toContain('<script>alert(1)</script>');
    expect(result.text).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('uses the public Pulse logo URL when API_PUBLIC_URL is configured', () => {
    Environment.vars = {
      API_PUBLIC_URL: 'https://api.example.com/base',
    } as typeof Environment.vars;

    const result = new EmailTemplateRenderer().render('login-code', {
      title: 'Seu código de acesso',
      code: '123456',
      validMinutes: 10,
      context: 'Chrome',
    });

    expect(result.html).toContain(
      "src='https://api.example.com/assets/brand/pulse-logo.png'",
    );
    expect(result.html).not.toContain('cid:');
  });

  it('renders styled fallback text when API_PUBLIC_URL is not configured', () => {
    const result = new EmailTemplateRenderer().render('login-code', {
      title: 'Seu código de acesso',
      code: '123456',
      validMinutes: 10,
      context: 'Chrome',
    });

    expect(result.html).toContain('>Pulse Lead</span>');
    expect(result.html).toContain('color:#ffffff');
    expect(result.html).not.toContain('<img');
  });

  it('renders the login code and security guidance', () => {
    const result = new EmailTemplateRenderer().render('login-code', {
      title: 'Seu código de acesso',
      code: '123456',
      validMinutes: 10,
      context: 'Chrome',
    });

    expect(result.html).toContain('123456');
    expect(result.html).toContain('Chrome.');
    expect(result.html).not.toMatch(/\d+\.\d+\.\d+\.(x|\d+)/);
    expect(result.text.replace(/\s+/g, ' ')).toContain('válido por 10 minutos');
    expect(result.text).toContain('troque sua senha imediatamente');
  });
});
