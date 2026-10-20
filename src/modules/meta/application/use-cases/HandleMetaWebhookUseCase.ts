import { Injectable, Logger } from '@nestjs/common';
import type { MetaWebhookPayload } from '../../domain/types/MetaWebhookPayload';
import { HandleInstagramCommentUseCase } from './HandleInstagramCommentUseCase';

export type HandleMetaWebhookUseCaseOutput = {
  received: true;
  entries: number;
};

@Injectable()
export class HandleMetaWebhookUseCase {
  private readonly logger = new Logger(HandleMetaWebhookUseCase.name);

  constructor(private readonly handleComment: HandleInstagramCommentUseCase) {}

  async execute(
    payload: MetaWebhookPayload,
  ): Promise<HandleMetaWebhookUseCaseOutput> {
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];

    if (payload?.object === 'instagram') {
      const comments = entries.flatMap((entry) =>
        (entry.changes ?? [])
          .filter((change) => change.field === 'comments')
          .map((change) => ({
            accountId: String(entry.id),
            event: change.value,
          })),
      );

      const results = await Promise.allSettled(
        comments.map(({ accountId, event }) =>
          this.handleComment.execute(accountId, event),
        ),
      );

      results.forEach((result) => {
        if (result.status === 'rejected') {
          this.logger.error(
            `Falha ao processar comentário do Instagram: ${String(result.reason)}`,
          );
        }
      });
    }

    return { received: true, entries: entries.length };
  }
}
