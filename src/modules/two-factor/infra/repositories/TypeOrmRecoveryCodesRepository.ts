import { IsNull, type DataSource } from 'typeorm';
import type {
  RecoveryCodeRecord,
  RecoveryCodesRepository,
} from '../../domain/repositories/RecoveryCodesRepository';
import { TwoFactorRecoveryCodeOrmEntity } from '../entities/TwoFactorRecoveryCodeOrmEntity';

export class TypeOrmRecoveryCodesRepository implements RecoveryCodesRepository {
  constructor(private readonly dataSource: DataSource) {}

  countUnused(userId: string): Promise<number> {
    return this.dataSource
      .getRepository(TwoFactorRecoveryCodeOrmEntity)
      .count({ where: { userId, usedAt: IsNull() } });
  }

  async replaceForUser(
    userId: string,
    codes: RecoveryCodeRecord[],
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(TwoFactorRecoveryCodeOrmEntity);
      await repository.delete({ userId });
      if (codes.length > 0) await repository.insert(codes);
    });
  }

  async consume(userId: string, codeHash: string, now: Date): Promise<boolean> {
    const result = await this.dataSource
      .getRepository(TwoFactorRecoveryCodeOrmEntity)
      .createQueryBuilder()
      .update()
      .set({ usedAt: now })
      .where('"userId" = :userId', { userId })
      .andWhere('"codeHash" = :codeHash', { codeHash })
      .andWhere('"usedAt" IS NULL')
      .execute();
    return (result.affected ?? 0) === 1;
  }

  async deleteForUser(userId: string): Promise<void> {
    await this.dataSource
      .getRepository(TwoFactorRecoveryCodeOrmEntity)
      .delete({ userId });
  }
}
