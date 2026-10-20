import { ValidationError } from 'yup';
import { saveCommentAutomationSchema } from './CommentAutomationSchema';

describe('saveCommentAutomationSchema', () => {
  const base = { keywords: ['quero'], message: 'Oi!', isActive: true };
  // As mesmas opções do controller.
  const validate = (body: Record<string, unknown>) =>
    saveCommentAutomationSchema.validate(body, {
      abortEarly: false,
      stripUnknown: false,
    });
  const errorsOf = async (body: Record<string, unknown>) => {
    try {
      await validate(body);
      return [];
    } catch (error) {
      if (error instanceof ValidationError) return error.errors;
      throw error;
    }
  };

  it('accepts a rule without button and without public reply', async () => {
    await expect(validate(base)).resolves.toMatchObject({
      button: null,
      commentReply: null,
    });
  });

  it('accepts a button with an https link and a public reply', async () => {
    await expect(
      validate({
        ...base,
        button: { label: ' Ver material ', url: 'https://site.com/x' },
        commentReply: ' Te mandei no direct! ',
      }),
    ).resolves.toMatchObject({
      button: { label: 'Ver material', url: 'https://site.com/x' },
      commentReply: 'Te mandei no direct!',
    });
  });

  it.each([
    ['http', 'http://site.com'],
    ['javascript', 'javascript:alert(1)'],
    ['relative', '/material'],
  ])('refuses %s links in the button', async (_, url) => {
    expect(
      await errorsOf({ ...base, button: { label: 'Ver', url } }),
    ).toContain('Use um link que comece com https://.');
  });

  it('limits the button label to 20 characters', async () => {
    expect(
      await errorsOf({
        ...base,
        button: { label: 'x'.repeat(21), url: 'https://site.com' },
      }),
    ).toContain('O texto do botão deve ter no máximo 20 caracteres.');
  });

  it('limits the message to 640 characters only when there is a button', async () => {
    const message = 'x'.repeat(700);

    await expect(validate({ ...base, message })).resolves.toBeTruthy();
    expect(
      await errorsOf({
        ...base,
        message,
        button: { label: 'Ver', url: 'https://site.com' },
      }),
    ).toContain('Com botão, a mensagem deve ter no máximo 640 caracteres.');
  });

  it('treats a blank public reply as none', async () => {
    await expect(
      validate({ ...base, commentReply: '   ' }),
    ).resolves.toMatchObject({ commentReply: null });
  });

  it('refuses unknown fields in the button', async () => {
    expect(
      await errorsOf({
        ...base,
        button: { label: 'Ver', url: 'https://site.com', type: 'postback' },
      }),
    ).toContain('Campo não permitido.');
  });
});
