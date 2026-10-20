import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Índices e CHECKs ficam na migration CreateTrackingPixels. */
@Entity('tracking_pixels')
export class TrackingPixelOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  expertId: string;

  @Column({ type: 'varchar', length: 32 })
  publicKey: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  allowedDomains: string[];

  @Column({ type: 'timestamp', nullable: true })
  lastEventAt?: Date | null;

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
