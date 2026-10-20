/* eslint-disable @typescript-eslint/unbound-method */
import { DomainError } from '../../../../../shared/errors/DomainError';
import { IntegrationAccountType } from '../../../../integrations/domain/enums/IntegrationAccountType';
import { IntegrationProvider } from '../../../../integrations/domain/enums/IntegrationProvider';
import type { IntegrationAccountsRepository } from '../../../../integrations/domain/repositories/IntegrationAccountsRepository';
import { makeInstagramAccount } from '../../../../integrations/testing/integrationFixtures';
import {
  CommentAutomation,
  type CommentAutomationProps,
} from '../../../domain/entities/CommentAutomation';
import { CommentReplyStatus } from '../../../domain/enums/CommentReplyStatus';
import type { CommentAutomationsRepository } from '../../../domain/repositories/CommentAutomationsRepository';
import type { CommentRepliesRepository } from '../../../domain/repositories/CommentRepliesRepository';
import type { InstagramGraphClient } from '../../../infra/http/InstagramGraphClient';
import type { InstagramAccessTokens } from '../../services/InstagramAccessTokens';
import { HandleInstagramCommentUseCase } from '../HandleInstagramCommentUseCase';

describe('HandleInstagramCommentUseCase', () => {
  const igAccountId = 'ig-user';
  let accounts: jest.Mocked<IntegrationAccountsRepository>;
  let automations: jest.Mocked<CommentAutomationsRepository>;
  let replies: jest.Mocked<CommentRepliesRepository>;
  let tokens: jest.Mocked<Pick<InstagramAccessTokens, 'forExpert'>>;
  let graph: jest.Mocked<
    Pick<InstagramGraphClient, 'sendPrivateReply' | 'replyToComment'>
  >;
  let useCase: HandleInstagramCommentUseCase;
  let nextId = 0;

  const comment = (overrides: Record<string, unknown> = {}) => ({
    id: 'comment-1',
    text: 'Eu QUERO o material!',
    from: { id: 'follower-1', username: 'fan' },
    media: { id: 'reel-1', media_product_type: 'REELS' },
    ...overrides,
  });

  beforeEach(() => {
    nextId = 0;
    accounts = {
      findConnectedByExpert: jest.fn(),
      findConnectedByTenant: jest.fn(),
      findConnectedByExternalId: jest
        .fn()
        .mockResolvedValue([makeInstagramAccount({ externalId: igAccountId })]),
    };
    automations = {
      upsert: jest.fn(),
      findByExpert: jest.fn(),
      findByMedia: jest.fn().mockResolvedValue(makeAutomation()),
      delete: jest.fn(),
    };
    replies = {
      claim: jest.fn().mockResolvedValue(true),
      markSent: jest.fn(),
      markFailed: jest.fn(),
      markPublicReply: jest.fn(),
      statsByAutomation: jest.fn(),
    };
    tokens = { forExpert: jest.fn().mockResolvedValue('plain-token') };
    graph = {
      sendPrivateReply: jest.fn().mockResolvedValue({ messageId: 'm-1' }),
      replyToComment: jest.fn().mockResolvedValue(undefined),
    };
    useCase = new HandleInstagramCommentUseCase(
      accounts,
      automations,
      replies,
      tokens as unknown as InstagramAccessTokens,
      graph as unknown as InstagramGraphClient,
      { generate: () => `id-${++nextId}` },
    );
  });

  it('sends the DM once when the comment has the keyword', async () => {
    await expect(useCase.execute(igAccountId, comment())).resolves.toEqual([
      'sent',
    ]);

    expect(accounts.findConnectedByExternalId).toHaveBeenCalledWith(
      IntegrationProvider.INSTAGRAM,
      IntegrationAccountType.INSTAGRAM_ACCOUNT,
      igAccountId,
    );
    expect(automations.findByMedia).toHaveBeenCalledWith(
      'tenant-a',
      'expert-a',
      'reel-1',
    );
    const [claimed] = replies.claim.mock.calls[0];
    expect(claimed).toMatchObject({
      tenantId: 'tenant-a',
      expertId: 'expert-a',
      automationId: 'automation-1',
      commentId: 'comment-1',
      commenterId: 'follower-1',
      matchedKeyword: 'quero',
      status: CommentReplyStatus.PENDING,
    });
    expect(JSON.stringify(claimed)).not.toContain('material');
    expect(tokens.forExpert).toHaveBeenCalledWith('tenant-a', 'expert-a');
    expect(graph.sendPrivateReply).toHaveBeenCalledWith({
      instagramUserId: igAccountId,
      commentId: 'comment-1',
      text: 'Aqui está o link!',
      accessToken: 'plain-token',
    });
    expect(replies.markSent).toHaveBeenCalledWith(claimed.id, expect.any(Date));
  });

  it('accepts the comment id in comment_id', async () => {
    await useCase.execute(
      igAccountId,
      comment({ id: undefined, comment_id: 'comment-2' }),
    );

    expect(graph.sendPrivateReply).toHaveBeenCalledWith(
      expect.objectContaining({ commentId: 'comment-2' }),
    );
  });

  it('never answers comments made by the account itself', async () => {
    await expect(
      useCase.execute(igAccountId, comment({ from: { id: igAccountId } })),
    ).resolves.toEqual(['ignored']);
    expect(accounts.findConnectedByExternalId).not.toHaveBeenCalled();
  });

  it.each([
    ['without text', { text: undefined }],
    ['without media', { media: undefined }],
    ['without author', { from: undefined }],
    ['with an invalid comment id', { id: 'x'.repeat(65) }],
  ])('ignores events %s', async (_, overrides) => {
    await expect(
      useCase.execute(igAccountId, comment(overrides)),
    ).resolves.toEqual(['ignored']);
    expect(graph.sendPrivateReply).not.toHaveBeenCalled();
  });

  it('does nothing when the Reel has no automation', async () => {
    automations.findByMedia.mockResolvedValue(null);

    await expect(useCase.execute(igAccountId, comment())).resolves.toEqual([
      'no_match',
    ]);
    expect(replies.claim).not.toHaveBeenCalled();
  });

  it('does nothing when the comment lacks the keyword', async () => {
    await expect(
      useCase.execute(igAccountId, comment({ text: 'Que lindo!' })),
    ).resolves.toEqual(['no_match']);
    expect(replies.claim).not.toHaveBeenCalled();
  });

  it('does nothing while the automation is paused', async () => {
    automations.findByMedia.mockResolvedValue(makeAutomation(false));

    await expect(useCase.execute(igAccountId, comment())).resolves.toEqual([
      'no_match',
    ]);
  });

  it('does not send a second DM when Meta repeats the webhook', async () => {
    replies.claim.mockResolvedValue(false);

    await expect(useCase.execute(igAccountId, comment())).resolves.toEqual([
      'duplicate',
    ]);
    expect(graph.sendPrivateReply).not.toHaveBeenCalled();
  });

  it('records the failure when the DM cannot be sent', async () => {
    tokens.forExpert.mockRejectedValue(
      new DomainError(409, 'INSTAGRAM_ACCESS_TOKEN_EXPIRED'),
    );

    await expect(useCase.execute(igAccountId, comment())).resolves.toEqual([
      'failed',
    ]);
    expect(graph.sendPrivateReply).not.toHaveBeenCalled();
    expect(replies.markFailed).toHaveBeenCalledWith(
      'id-1',
      'INSTAGRAM_ACCESS_TOKEN_EXPIRED',
    );
  });

  it('follows the rules of each tenant that connected the account', async () => {
    accounts.findConnectedByExternalId.mockResolvedValue([
      makeInstagramAccount({ externalId: igAccountId }),
      makeInstagramAccount({
        externalId: igAccountId,
        tenantId: 'tenant-b',
        expertId: 'expert-b',
      }),
    ]);
    automations.findByMedia.mockImplementation((tenantId) =>
      Promise.resolve(tenantId === 'tenant-a' ? makeAutomation() : null),
    );

    await expect(useCase.execute(igAccountId, comment())).resolves.toEqual([
      'sent',
      'no_match',
    ]);
    expect(graph.sendPrivateReply).toHaveBeenCalledTimes(1);
  });

  describe('button and public reply', () => {
    const button = { label: 'Ver material', url: 'https://site.com/material' };

    it('sends the button with the DM', async () => {
      automations.findByMedia.mockResolvedValue(
        makeAutomation(true, { button }),
      );

      await expect(useCase.execute(igAccountId, comment())).resolves.toEqual([
        'sent',
      ]);
      expect(graph.sendPrivateReply).toHaveBeenCalledTimes(1);
      expect(graph.sendPrivateReply).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Aqui está o link!', button }),
      );
    });

    it('falls back to the link in the text when Meta refuses the button', async () => {
      automations.findByMedia.mockResolvedValue(
        makeAutomation(true, { button }),
      );
      graph.sendPrivateReply
        .mockRejectedValueOnce(
          new DomainError(502, 'INSTAGRAM_GRAPH_API_ERROR'),
        )
        .mockResolvedValueOnce({ messageId: 'm-2' });

      await expect(useCase.execute(igAccountId, comment())).resolves.toEqual([
        'sent',
      ]);
      expect(graph.sendPrivateReply).toHaveBeenLastCalledWith(
        expect.objectContaining({
          text: 'Aqui está o link!\n\nVer material: https://site.com/material',
        }),
      );
      expect(graph.sendPrivateReply.mock.calls[1][0]).not.toHaveProperty(
        'button',
      );
    });

    it('does not retry when the token is the problem', async () => {
      automations.findByMedia.mockResolvedValue(
        makeAutomation(true, { button }),
      );
      graph.sendPrivateReply.mockRejectedValue(
        new DomainError(409, 'INSTAGRAM_ACCESS_TOKEN_INVALID'),
      );

      await expect(useCase.execute(igAccountId, comment())).resolves.toEqual([
        'failed',
      ]);
      expect(graph.sendPrivateReply).toHaveBeenCalledTimes(1);
    });

    it('replies publicly to the comment after the DM', async () => {
      automations.findByMedia.mockResolvedValue(
        makeAutomation(true, { commentReply: 'Te mandei no direct!' }),
      );

      await useCase.execute(igAccountId, comment());

      expect(graph.replyToComment).toHaveBeenCalledWith({
        commentId: 'comment-1',
        text: 'Te mandei no direct!',
        accessToken: 'plain-token',
      });
      expect(replies.markPublicReply).toHaveBeenCalledWith('id-1', {
        sent: true,
      });
      expect(graph.sendPrivateReply.mock.invocationCallOrder[0]).toBeLessThan(
        graph.replyToComment.mock.invocationCallOrder[0],
      );
    });

    it('does not reply publicly when the DM failed', async () => {
      automations.findByMedia.mockResolvedValue(
        makeAutomation(true, { commentReply: 'Te mandei no direct!' }),
      );
      graph.sendPrivateReply.mockRejectedValue(
        new DomainError(502, 'INSTAGRAM_GRAPH_API_ERROR'),
      );

      await useCase.execute(igAccountId, comment());

      expect(graph.replyToComment).not.toHaveBeenCalled();
    });

    it('keeps the DM as sent when the public reply fails', async () => {
      automations.findByMedia.mockResolvedValue(
        makeAutomation(true, { commentReply: 'Te mandei no direct!' }),
      );
      graph.replyToComment.mockRejectedValue(
        new DomainError(502, 'INSTAGRAM_GRAPH_API_ERROR'),
      );

      await expect(useCase.execute(igAccountId, comment())).resolves.toEqual([
        'sent',
      ]);
      expect(replies.markSent).toHaveBeenCalled();
      expect(replies.markPublicReply).toHaveBeenCalledWith('id-1', {
        sent: false,
        reason: 'INSTAGRAM_GRAPH_API_ERROR',
      });
    });

    it('does not reply publicly when the rule has no public reply', async () => {
      await useCase.execute(igAccountId, comment());

      expect(graph.replyToComment).not.toHaveBeenCalled();
    });
  });
});

function makeAutomation(
  isActive = true,
  extra: Partial<CommentAutomationProps> = {},
): CommentAutomation {
  const now = new Date();
  return new CommentAutomation({
    id: 'automation-1',
    tenantId: 'tenant-a',
    expertId: 'expert-a',
    mediaId: 'reel-1',
    keywords: ['quero', 'link'],
    message: 'Aqui está o link!',
    isActive,
    createdAt: now,
    updatedAt: now,
    ...extra,
  });
}
