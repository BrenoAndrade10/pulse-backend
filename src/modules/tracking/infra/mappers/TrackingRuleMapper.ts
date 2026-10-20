import { TrackingRule } from '../../domain/entities/TrackingRule';
import { TrackingRuleOrmEntity } from '../entities/TrackingRuleOrmEntity';

export class TrackingRuleMapper {
  static toDomain(entity: TrackingRuleOrmEntity): TrackingRule {
    return new TrackingRule({
      id: entity.id,
      tenantId: entity.tenantId,
      expertId: entity.expertId,
      pixelId: entity.pixelId,
      pageUrl: entity.pageUrl,
      scope: entity.scope,
      trigger: entity.trigger,
      eventName: entity.eventName,
      element: entity.element,
      fields: entity.fields ?? [],
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  static toPersistence(rule: TrackingRule): TrackingRuleOrmEntity {
    const entity = new TrackingRuleOrmEntity();

    entity.id = rule.id;
    entity.tenantId = rule.tenantId;
    entity.expertId = rule.expertId;
    entity.pixelId = rule.pixelId;
    entity.pageUrl = rule.pageUrl;
    entity.scope = rule.scope;
    entity.trigger = rule.trigger;
    entity.eventName = rule.eventName;
    entity.element = rule.element;
    entity.fields = rule.fields;
    entity.createdAt = rule.createdAt;
    entity.updatedAt = rule.updatedAt;

    return entity;
  }
}
