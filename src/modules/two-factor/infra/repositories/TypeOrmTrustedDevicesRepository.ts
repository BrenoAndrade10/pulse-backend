import type { DataSource } from 'typeorm';
import type {
  TrustedDeviceRecord,
  TrustedDevicesRepository,
} from '../../domain/repositories/TrustedDevicesRepository';
import { TrustedDeviceOrmEntity } from '../entities/TrustedDeviceOrmEntity';

export class TypeOrmTrustedDevicesRepository implements TrustedDevicesRepository {
  constructor(private readonly dataSource: DataSource) {}

  async create(device: TrustedDeviceRecord): Promise<void> {
    await this.dataSource.getRepository(TrustedDeviceOrmEntity).insert(device);
  }

  async validateAndTouch(
    tokenHash: string,
    userId: string,
    now: Date,
  ): Promise<TrustedDeviceRecord | null> {
    const result = await this.dataSource
      .getRepository(TrustedDeviceOrmEntity)
      .createQueryBuilder()
      .update()
      .set({ lastUsedAt: now })
      .where('"tokenHash" = :tokenHash', { tokenHash })
      .andWhere('"userId" = :userId', { userId })
      .andWhere('"expiresAt" > timezone(\'utc\', now())')
      .returning([
        'id',
        'userId',
        'tokenHash',
        'label',
        'expiresAt',
        'lastUsedAt',
        'createdAt',
      ])
      .execute();
    const device = (result.raw as TrustedDeviceRecord[])[0];
    return device ?? null;
  }

  listByUserId(userId: string): Promise<TrustedDeviceRecord[]> {
    return this.dataSource.getRepository(TrustedDeviceOrmEntity).find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async revoke(userId: string, deviceId: string): Promise<boolean> {
    const result = await this.dataSource
      .getRepository(TrustedDeviceOrmEntity)
      .delete({ id: deviceId, userId });
    return (result.affected ?? 0) === 1;
  }

  async deleteForUser(userId: string): Promise<void> {
    await this.dataSource
      .getRepository(TrustedDeviceOrmEntity)
      .delete({ userId });
  }
}
