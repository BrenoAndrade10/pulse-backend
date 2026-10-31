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

  it('never logs e-mail content in production', async () => {
    process.env.NODE_ENV = 'production';
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    await new LogEmailSender().send(input);
    expect(log).not.toHaveBeenCalled();
  });
});
