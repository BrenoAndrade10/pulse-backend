import { Injectable } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { TrackingRule } from '../../domain/entities/TrackingRule';
import type {
  TrackingPageSummary,
  TrackingRulesRepository,
} from '../../domain/repositories/TrackingRulesRepository';
import { TrackingRuleOrmEntity } from '../entities/TrackingRuleOrmEntity';
import { TrackingRuleMapper } from '../mappers/TrackingRuleMapper';

@Injectable()
export class TypeOrmTrackingRulesRepository implements TrackingRulesRepository {
  constructor(private readonly repository: Repository<TrackingRuleOrmEntity>) {}

  async create(rule: TrackingRule): Promise<TrackingRule> {
    // `save` em vez de `insert`: o tipo do insert não aceita jsonb genérico.
    await this.repository.save(TrackingRuleMapper.toPersistence(rule));
    return rule;
  }

  async findForPage(pixelId: string, pageUrl: string): Promise<TrackingRule[]> {
    const entities = await this.repository
      .createQueryBuilder('rule')
      .where('rule.pixelId = :pixelId', { pixelId })
      .andWhere("(rule.pageUrl = :pageUrl OR rule.scope = 'site')", {
        pageUrl,
      })
      .orderBy('rule.createdAt', 'ASC')
      .getMany();

    return entities.map((entity) => TrackingRuleMapper.toDomain(entity));
  }

  async findByPixel(pixelId: string): Promise<TrackingRule[]> {
    const entities = await this.repository.find({
      where: { pixelId },
      order: { createdAt: 'ASC' },
    });
    return entities.map((entity) => TrackingRuleMapper.toDomain(entity));
  }

  countByPixel(pixelId: string): Promise<number> {
    return this.repository.count({ where: { pixelId } });
  }

  async delete(pixelId: string, ruleId: string): Promise<boolean> {
    const result = await this.repository.delete({ pixelId, id: ruleId });
    return (result.affected ?? 0) > 0;
  }

  async pagesByPixel(pixelId: string): Promise<TrackingPageSummary[]> {
    const rows = await this.repository
      .createQueryBuilder('rule')
      .select('rule.pageUrl', 'url')
      .addSelect('COUNT(*)', 'eventsCount')
      .addSelect('MAX(rule.updatedAt)', 'updatedAt')
      .where('rule.pixelId = :pixelId', { pixelId })
      .groupBy('rule.pageUrl')
      .orderBy('MAX(rule.updatedAt)', 'DESC')
      .getRawMany<{ url: string; eventsCount: string; updatedAt: Date }>();

    return rows.map((row) => ({
      url: row.url,
      eventsCount: Number(row.eventsCount),
      updatedAt: row.updatedAt,
    }));
  }
}
