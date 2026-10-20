import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  TrackingRuleElement,
  TrackingRuleField,
  TrackingRuleScope,
  TrackingRuleTrigger,
} from '../../domain/entities/TrackingRule';

/** Índices e CHECKs ficam na migration CreateTrackingRules. */
@Entity('tracking_rules')
export class TrackingRuleOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  expertId: string;

  @Column({ type: 'uuid' })
  pixelId: string;

  @Column({ type: 'varchar', length: 2048 })
  pageUrl: string;

  @Column({ type: 'varchar', length: 8 })
  scope: TrackingRuleScope;

  @Column({ type: 'varchar', length: 16 })
  trigger: TrackingRuleTrigger;

  @Column({ type: 'varchar', length: 40 })
  eventName: string;

  @Column({ type: 'jsonb' })
  element: TrackingRuleElement;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  fields: TrackingRuleField[];

  @CreateDateColumn({
    type: 'timestamp',
    default: () => "timezone('utc', now())",
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => "timezone('utc', now())",
  })
  updatedAt: Date;
}
