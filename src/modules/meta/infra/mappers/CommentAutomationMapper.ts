import { CommentAutomation } from '../../domain/entities/CommentAutomation';
import { CommentAutomationOrmEntity } from '../entities/CommentAutomationOrmEntity';

export class CommentAutomationMapper {
  static toDomain(entity: CommentAutomationOrmEntity): CommentAutomation {
    return new CommentAutomation({
      id: entity.id,
      tenantId: entity.tenantId,
      expertId: entity.expertId,
      mediaId: entity.mediaId,
      keywords: entity.keywords,
      message: entity.message,
      button:
        entity.buttonLabel && entity.buttonUrl
          ? { label: entity.buttonLabel, url: entity.buttonUrl }
          : undefined,
      commentReply: entity.commentReply ?? undefined,
      isActive: entity.isActive,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  static toPersistence(
    automation: CommentAutomation,
  ): CommentAutomationOrmEntity {
    const entity = new CommentAutomationOrmEntity();

    entity.id = automation.id;
    entity.tenantId = automation.tenantId;
    entity.expertId = automation.expertId;
    entity.mediaId = automation.mediaId;
    entity.keywords = automation.keywords;
    entity.message = automation.message;
    entity.buttonLabel = automation.button?.label ?? null;
    entity.buttonUrl = automation.button?.url ?? null;
    entity.commentReply = automation.commentReply ?? null;
    entity.isActive = automation.isActive;
    entity.createdAt = automation.createdAt;
    entity.updatedAt = automation.updatedAt;

    return entity;
  }
}
