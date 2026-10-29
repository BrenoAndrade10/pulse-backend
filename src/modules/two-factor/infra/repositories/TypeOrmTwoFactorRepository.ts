import type { DataSource } from 'typeorm';
import type {
  ConfirmTwoFactorInput,
  PendingTwoFactorSecret,
  RegenerateRecoveryCodesInput,
  TwoFactorRepository,
  TwoFactorState,
} from '../../domain/repositories/TwoFactorRepository';
import { TrustedDeviceOrmEntity } from '../entities/TrustedDeviceOrmEntity';
import { TwoFactorRecoveryCodeOrmEntity } from '../entities/TwoFactorRecoveryCodeOrmEntity';
import { UserTwoFactorOrmEntity } from '../entities/UserTwoFactorOrmEntity';

export class TypeOrmTwoFactorRepository implements TwoFactorRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findByUserId(userId: string): Promise<TwoFactorState | null> {
    const entity = await this.dataSource
      .getRepository(UserTwoFactorOrmEntity)
      .findOne({ where: { userId } });
    if (!entity) return null;
    return {
      ...entity,
      confirmedAt: entity.confirmedAt ?? null,
      lastUsedStep:
        entity.lastUsedStep === null || entity.lastUsedStep === undefined
          ? null
          : Number(entity.lastUsedStep),
    };
  }

  async upsertPending(input: PendingTwoFactorSecret): Promise<void> {
    await this.dataSource
      .getRepository(UserTwoFactorOrmEntity)
      .createQueryBuilder()
      .insert()
      .values({
        userId: input.userId,
        secretEncrypted: input.secretEncrypted,
        secretIv: input.secretIv,
        secretAuthTag: input.secretAuthTag,
        confirmedAt: null,
        lastUsedStep: null,
        createdAt: input.now,
        updatedAt: input.now,
      })
      .orUpdate(
        [
          'secretEncrypted',
          'secretIv',
          'secretAuthTag',
          'confirmedAt',
          'lastUsedStep',
          'updatedAt',
        ],
        ['userId'],
        {
          overwriteCondition: {
            where: '"UserTwoFactorOrmEntity"."confirmedAt" IS NULL',
          },
        },
      )
      .execute();
  }

  async updateLastUsedStep(
    userId: string,
    step: number,
    now: Date,
  ): Promise<boolean> {
    const result = await this.dataSource
      .getRepository(UserTwoFactorOrmEntity)
      .createQueryBuilder()
      .update()
      .set({ lastUsedStep: String(step), updatedAt: now })
      .where('"userId" = :userId', { userId })
      .andWhere(
        '("lastUsedStep" IS NULL OR "lastUsedStep" < CAST(:step AS bigint))',
        { step },
      )
      .execute();
    return (result.affected ?? 0) === 1;
  }

  async confirmAndReplaceRecoveryCodes(
    input: ConfirmTwoFactorInput,
  ): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const result = await manager
        .getRepository(UserTwoFactorOrmEntity)
        .createQueryBuilder()
        .update()
        .set({
          confirmedAt: input.now,
          lastUsedStep: String(input.step),
          updatedAt: input.now,
        })
        .where('"userId" = :userId', { userId: input.userId })
        .andWhere('"secretEncrypted" = :secretEncrypted', {
          secretEncrypted: input.expectedSecretEncrypted,
        })
        .andWhere('"confirmedAt" IS NULL')
        .andWhere('"updatedAt" > :setupValidAfter', {
          setupValidAfter: input.setupValidAfter,
        })
        .andWhere(
          '("lastUsedStep" IS NULL OR "lastUsedStep" < CAST(:step AS bigint))',
          { step: input.step },
        )
        .execute();
      if ((result.affected ?? 0) !== 1) return false;

      const codes = manager.getRepository(TwoFactorRecoveryCodeOrmEntity);
      await codes.delete({ userId: input.userId });
      await codes.insert(input.recoveryCodes);
      return true;
    });
  }

  async regenerateRecoveryCodes(
    input: RegenerateRecoveryCodesInput,
  ): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const result = await manager
        .getRepository(UserTwoFactorOrmEntity)
        .createQueryBuilder()
        .update()
        .set({ lastUsedStep: String(input.step), updatedAt: input.now })
        .where('"userId" = :userId', { userId: input.userId })
        .andWhere('"confirmedAt" IS NOT NULL')
        .andWhere(
          '("lastUsedStep" IS NULL OR "lastUsedStep" < CAST(:step AS bigint))',
          { step: input.step },
        )
        .execute();
      if ((result.affected ?? 0) !== 1) return false;

      const codes = manager.getRepository(TwoFactorRecoveryCodeOrmEntity);
      await codes.delete({ userId: input.userId });
      await codes.insert(input.recoveryCodes);
      return true;
    });
  }

  async deleteForUser(userId: string): Promise<void> {
    await this.dataSource
      .getRepository(UserTwoFactorOrmEntity)
      .delete({ userId });
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(TrustedDeviceOrmEntity).delete({ userId });
      await manager
        .getRepository(TwoFactorRecoveryCodeOrmEntity)
        .delete({ userId });
      await manager.getRepository(UserTwoFactorOrmEntity).delete({ userId });
    });
  }
}
