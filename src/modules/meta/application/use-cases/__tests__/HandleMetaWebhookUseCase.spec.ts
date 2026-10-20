import type { HandleInstagramCommentUseCase } from '../HandleInstagramCommentUseCase';
import { HandleMetaWebhookUseCase } from '../HandleMetaWebhookUseCase';

describe('HandleMetaWebhookUseCase', () => {
  let handleComment: jest.Mocked<
    Pick<HandleInstagramCommentUseCase, 'execute'>
  >;
  let useCase: HandleMetaWebhookUseCase;

  beforeEach(() => {
    handleComment = { execute: jest.fn().mockResolvedValue(['sent']) };
    useCase = new HandleMetaWebhookUseCase(
      handleComment as unknown as HandleInstagramCommentUseCase,
    );
  });

  it('routes only Instagram comment changes', async () => {
    const value = { id: 'comment-1', text: 'quero' };

    await expect(
      useCase.execute({
        object: 'instagram',
        entry: [
          {
            id: 'ig-user',
            time: 1,
            changes: [
              { field: 'comments', value },
              { field: 'mentions', value: {} },
            ],
          },
        ],
      }),
    ).resolves.toEqual({ received: true, entries: 1 });

    expect(handleComment.execute).toHaveBeenCalledTimes(1);
    expect(handleComment.execute).toHaveBeenCalledWith('ig-user', value);
  });

  it('ignores other objects', async () => {
    await useCase.execute({
      object: 'page',
      entry: [
        {
          id: 'page',
          time: 1,
          changes: [{ field: 'comments', value: {} }],
        },
      ],
    });

    expect(handleComment.execute).not.toHaveBeenCalled();
  });

  it('acknowledges the webhook even if a comment fails', async () => {
    handleComment.execute.mockRejectedValue(new Error('database down'));

    await expect(
      useCase.execute({
        object: 'instagram',
        entry: [
          {
            id: 'ig-user',
            time: 1,
            changes: [{ field: 'comments', value: {} }],
          },
        ],
      }),
    ).resolves.toEqual({ received: true, entries: 1 });
  });
});
