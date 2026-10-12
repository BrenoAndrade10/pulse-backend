import { Injectable } from '@nestjs/common';
import type { MetaWebhookPayload } from '../../domain/types/MetaWebhookPayload';

export type HandleMetaWebhookUseCaseOutput = {
  received: true;
  entries: number;
};

@Injectable()
export class HandleMetaWebhookUseCase {
  execute(payload: MetaWebhookPayload): HandleMetaWebhookUseCaseOutput {
    // Próximo passo: rotear eventos de comentários e mensagens para casos de uso específicos.
    return {
      received: true,
      entries: payload.entry?.length ?? 0,
    };
  }
}
