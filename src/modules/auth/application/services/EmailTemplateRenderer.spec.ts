import { EmailTemplateRenderer } from './EmailTemplateRenderer';

describe('EmailTemplateRenderer', () => {
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

  it('renders the login code and security guidance', () => {
    const result = new EmailTemplateRenderer().render('login-code', {
      title: 'Seu código de acesso',
      code: '123456',
      validMinutes: 10,
      context: 'Chrome · 192.0.2.x',
    });

    expect(result.html).toContain('123456');
    expect(result.text.replace(/\s+/g, ' ')).toContain('válido por 10 minutos');
    expect(result.text).toContain('troque sua senha imediatamente');
  });
});
