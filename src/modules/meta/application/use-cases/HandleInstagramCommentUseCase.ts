import { Inject, Injectable, Logger } from '@nestjs/common';
import { ID_GENERATOR } from '../../../../shared/domain/IdGenerator';
import type { IdGenerator } from '../../../../shared/domain/IdGenerator';
import { DomainError } from '../../../../shared/errors/DomainError';
import type { IntegrationAccount } from '../../../integrations/domain/entities/IntegrationAccount';
import { IntegrationAccountType } from '../../../integrations/domain/enums/IntegrationAccountType';
import { IntegrationProvider } from '../../../integrations/domain/enums/IntegrationProvider';
import { INTEGRATION_ACCOUNTS_REPOSITORY } from '../../../integrations/domain/repositories/IntegrationAccountsRepository';
import type { IntegrationAccountsRepository } from '../../../integrations/domain/repositories/IntegrationAccountsRepository';
import type { CommentAutomation } from '../../domain/entities/CommentAutomation';
import { CommentReply } from '../../domain/entities/CommentReply';
import { CommentReplyStatus } from '../../domain/enums/CommentReplyStatus';
import { MAX_REPLY_MESSAGE_LENGTH } from '../../domain/services/commentKeywords';
import { COMMENT_AUTOMATIONS_REPOSITORY } from '../../domain/repositories/CommentAutomationsRepository';
import type { CommentAutomationsRepository } from '../../domain/repositories/CommentAutomationsRepository';
import { COMMENT_REPLIES_REPOSITORY } from '../../domain/repositories/CommentRepliesRepository';
import type { CommentRepliesRepository } from '../../domain/repositories/CommentRepliesRepository';
import { InstagramGraphClient } from '../../infra/http/InstagramGraphClient';
import { InstagramAccessTokens } from '../services/InstagramAccessTokens';

export type InstagramCommentEvent = {
  id?: unknown;
  comment_id?: unknown;
  text?: unknown;
  from?: { id?: unknown };
  media?: { id?: unknown };
};

export type HandleInstagramCommentOutcome =
  'ignored' | 'no_match' | 'duplicate' | 'sent' | 'failed';

const asId = (value: unknown): string | null =>
  typeof value === 'string' && /^[\w-]{1,64}$/.test(value) ? value : null;

@Injectable()
export class HandleInstagramCommentUseCase {
  private readonly logger = new Logger(HandleInstagramCommentUseCase.name);

  constructor(
    @Inject(INTEGRATION_ACCOUNTS_REPOSITORY)
    private readonly accountsRepository: IntegrationAccountsRepository,

    @Inject(COMMENT_AUTOMATIONS_REPOSITORY)
    private readonly automationsRepository: CommentAutomationsRepository,

    @Inject(COMMENT_REPLIES_REPOSITORY)
    private readonly repliesRepository: CommentRepliesRepository,

    private readonly accessTokens: InstagramAccessTokens,
    private readonly instagramGraphClient: InstagramGraphClient,

    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(
    instagramAccountId: string,
    event: InstagramCommentEvent,
  ): Promise<HandleInstagramCommentOutcome[]> {
    const accountId = asId(instagramAccountId);
    const commentId = asId(event.id) ?? asId(event.comment_id);
    const mediaId = asId(event.media?.id);
    const commenterId = asId(event.from?.id);
    const text = typeof event.text === 'string' ? event.text : '';

    if (
      !accountId ||
      !commentId ||
      !mediaId ||
      !commenterId ||
      !text ||
      commenterId === accountId
    ) {
      return ['ignored'];
    }

    const accounts = await this.accountsRepository.findConnectedByExternalId(
      IntegrationProvider.INSTAGRAM,
      IntegrationAccountType.INSTAGRAM_ACCOUNT,
      accountId,
    );

    return Promise.all(
      accounts.map((account) =>
        this.handleForAccount(account, {
          commentId,
          mediaId,
          commenterId,
          text,
        }),
      ),
    );
  }

  private async handleForAccount(
    account: IntegrationAccount,
    comment: {
      commentId: string;
      mediaId: string;
      commenterId: string;
      text: string;
    },
  ): Promise<HandleInstagramCommentOutcome> {
    const automation = await this.automationsRepository.findByMedia(
      account.tenantId,
      account.expertId,
      comment.mediaId,
    );
    const keyword = automation?.matchingKeyword(comment.text);

    if (!automation || !keyword) return 'no_match';

    const now = new Date();
    const reply = new CommentReply({
      id: this.idGenerator.generate(),
      tenantId: account.tenantId,
      expertId: account.expertId,
      automationId: automation.id,
      mediaId: comment.mediaId,
      commentId: comment.commentId,
      commenterId: comment.commenterId,
      matchedKeyword: keyword,
      status: CommentReplyStatus.PENDING,
      createdAt: now,
      updatedAt: now,
    });

    if (!(await this.repliesRepository.claim(reply))) return 'duplicate';

    let accessToken: string;

    try {
      accessToken = await this.accessTokens.forExpert(
        account.tenantId,
        account.expertId,
      );
      await this.sendDirectMessage(
        account,
        comment.commentId,
        automation,
        accessToken,
      );
      await this.repliesRepository.markSent(reply.id, new Date());
    } catch (error) {
      const reason =
        error instanceof DomainError && error.reason
          ? error.reason
          : 'UNEXPECTED_ERROR';

      this.logger.warn(
        `DM automática não enviada (expert ${account.expertId}, comentário ${comment.commentId}): ${reason}`,
      );
      await this.repliesRepository.markFailed(reply.id, reason);

      return 'failed';
    }

    if (automation.commentReply) {
      await this.replyPublicly(
        reply.id,
        comment.commentId,
        automation.commentReply,
        accessToken,
      );
    }

    return 'sent';
  }

  private async sendDirectMessage(
    account: IntegrationAccount,
    commentId: string,
    automation: CommentAutomation,
    accessToken: string,
  ): Promise<void> {
    const message = {
      instagramUserId: account.externalId,
      commentId,
      text: automation.message,
      accessToken,
    };
    const button = automation.button;

    if (!button) {
      await this.instagramGraphClient.sendPrivateReply(message);
      return;
    }

    try {
      await this.instagramGraphClient.sendPrivateReply({ ...message, button });
    } catch (error) {
      if (
        !(error instanceof DomainError) ||
        error.reason !== 'INSTAGRAM_GRAPH_API_ERROR'
      ) {
        throw error;
      }

      this.logger.warn(
        `Meta recusou o botão na DM (comentário ${commentId}); enviando o link no texto.`,
      );
      await this.instagramGraphClient.sendPrivateReply({
        ...message,
        text: `${automation.message}\n\n${button.label}: ${button.url}`.slice(
          0,
          MAX_REPLY_MESSAGE_LENGTH,
        ),
      });
    }
  }

  /** Falhar aqui não desfaz a DM: só fica registrado. */
  private async replyPublicly(
    replyId: string,
    commentId: string,
    text: string,
    accessToken: string,
  ): Promise<void> {
    try {
      await this.instagramGraphClient.replyToComment({
        commentId,
        text,
        accessToken,
      });
      await this.repliesRepository.markPublicReply(replyId, { sent: true });
    } catch (error) {
      const reason =
        error instanceof DomainError && error.reason
          ? error.reason
          : 'UNEXPECTED_ERROR';

      this.logger.warn(
        `Resposta pública não publicada (comentário ${commentId}): ${reason}`,
      );
      await this.repliesRepository.markPublicReply(replyId, {
        sent: false,
        reason,
      });
    }
  }
}
