import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LinkChannel } from '../../domain/enums/LinkChannel';
import { LinkPurpose } from '../../domain/enums/LinkPurpose';
import { LinkStatus } from '../../domain/enums/LinkStatus';

@Entity('links')
@Index('UQ_links_code', ['code'], { unique: true })
@Index('IDX_links_tenant_status', ['tenantId', 'status'])
@Index('IDX_links_tenant_expert', ['tenantId', 'expertId'])
@Index('IDX_links_tenant_launch', ['tenantId', 'launchId'])
@Check(
  'CHK_links_destination_url_length',
  'char_length("destinationUrl") <= 2048',
)
@Check('CHK_links_code_format', '"code" ~ \'^[a-z0-9]{7,16}$\'')
@Check(
  'CHK_links_channel',
  "\"channel\" IN ('instagram', 'whatsapp', 'telegram', 'email', 'ads', 'other')",
)
@Check(
  'CHK_links_purpose',
  "\"purpose\" IN ('content', 'capture', 'event', 'offer', 'checkout', 'other')",
)
@Check('CHK_links_status', "\"status\" IN ('active', 'inactive')")
export class LinkOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid', nullable: true })
  expertId: string | null;

  @Column({ type: 'uuid', nullable: true })
  launchId: string | null;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'text' })
  destinationUrl: string;

  @Column({ type: 'varchar', length: 16 })
  code: string;

  @Column({ type: 'varchar', length: 32 })
  channel: LinkChannel;

  @Column({ type: 'varchar', length: 64, nullable: true })
  placement: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  campaign: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  utmSource: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  utmMedium: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  utmCampaign: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  utmContent: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  utmTerm: string | null;

  @Column({ type: 'varchar', length: 32, default: LinkPurpose.OTHER })
  purpose: LinkPurpose;

  @Column({ type: 'varchar', length: 16, default: LinkStatus.ACTIVE })
  status: LinkStatus;

  @Column({ type: 'integer', default: 1 })
  destinationVersion: number;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

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

  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}
