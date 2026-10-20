import { Injectable } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { CommentAutomation } from '../../domain/entities/CommentAutomation';
import type { CommentAutomationsRepository } from '../../domain/repositories/CommentAutomationsRepository';
import { CommentAutomationOrmEntity } from '../entities/CommentAutomationOrmEntity';
import { CommentAutomationMapper } from '../mappers/CommentAutomationMapper';

@Injectable()
export class TypeOrmCommentAutomationsRepository implements CommentAutomationsRepository {
  constructor(
    private readonly repository: Repository<CommentAutomationOrmEntity>,
  ) {}

  async upsert(automation: CommentAutomation): Promise<CommentAutomation> {
    const entity = CommentAutomationMapper.toPersistence(automation);

    // Uma regra por expert e mídia: em conflito, atualiza a existente e
    // mantém o id e a data de criação dela.
    await this.repository
      .createQueryBuilder()
      .insert()
      .values(entity)
      .orUpdate(
        [
          'keywords',
          'message',
          'buttonLabel',
          'buttonUrl',
          'commentReply',
          'isActive',
          'updatedAt',
        ],
        ['tenantId', 'expertId', 'mediaId'],
      )
      .execute();

    const saved = await this.findByMedia(
      automation.tenantId,
      automation.expertId,
      automation.mediaId,
    );

    return saved!;
  }

  async findByExpert(
    tenantId: string,
    expertId: string,
  ): Promise<CommentAutomation[]> {
    const automations = await this.repository.find({
      where: { tenantId, expertId },
      order: { createdAt: 'DESC' },
    });

    return automations.map((automation) =>
      CommentAutomationMapper.toDomain(automation),
    );
  }

  async findByMedia(
    tenantId: string,
    expertId: string,
    mediaId: string,
  ): Promise<CommentAutomation | null> {
    const automation = await this.repository.findOne({
      where: { tenantId, expertId, mediaId },
    });

    return automation ? CommentAutomationMapper.toDomain(automation) : null;
  }

  async delete(
    tenantId: string,
    expertId: string,
    mediaId: string,
  ): Promise<boolean> {
    const result = await this.repository.delete({
      tenantId,
      expertId,
      mediaId,
    });

    return (result.affected ?? 0) > 0;
  }
}
