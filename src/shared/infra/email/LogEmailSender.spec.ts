import { Logger } from '@nestjs/common';
import { LogEmailSender } from './LogEmailSender';

describe('LogEmailSender', () => {
  const input = {
    to: 'user@example.com',
    subject: 'Assunto',
    html: '<p>token-secret</p>',
    text: 'token-secret',
  };
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  it('logs the complete text outside production', async () => {
    process.env.NODE_ENV = 'test';
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    await new LogEmailSender().send(input);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('token-secret'));
  });

  it('reports the missing provider on production boot without sensitive data', async () => {
    process.env.NODE_ENV = 'production';
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const sender = new LogEmailSender();

    sender.onModuleInit();
    await sender.send(input);
    expect(error).toHaveBeenCalledWith(
      'EMAIL_PROVIDER_NOT_CONFIGURED: recuperação de senha inoperante',
    );
    expect(error).not.toHaveBeenCalledWith(expect.stringContaining(input.to));
  });
});
