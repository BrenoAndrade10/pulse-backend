import { IsNull, Not, type DataSource } from 'typeorm';
import { UserOrmEntity } from '../../../users/infra/entities/UserOrmEntity';
import type {
  ConsumedPasswordReset,
  CreatePasswordResetTokenInput,
  PasswordResetTokensRepository,
} from '../../domain/repositories/PasswordResetTokensRepository';
import { PasswordResetTokenOrmEntity } from '../entities/PasswordResetTokenOrmEntity';

export class TypeOrmPasswordResetTokensRepository implements PasswordResetTokensRepository {
  constructor(private readonly dataSource: DataSource) {}

  async replaceForUser(input: CreatePasswordResetTokenInput): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(PasswordResetTokenOrmEntity)
        .update(
          { userId: input.userId, usedAt: IsNull() },
          { usedAt: input.createdAt },
        );
      await manager.getRepository(PasswordResetTokenOrmEntity).insert(input);
    });
  }

  async findValid(tokenHash: string): Promise<ConsumedPasswordReset | null> {
    const token = await this.dataSource
      .getRepository(PasswordResetTokenOrmEntity)
      .createQueryBuilder('token')
      .where('token."tokenHash" = :tokenHash', { tokenHash })
      .andWhere('token."usedAt" IS NULL')
      .andWhere('token."expiresAt" > timezone(\'utc\', now())')
      .getOne();
    if (!token) return null;
    const user = await this.dataSource
      .getRepository(UserOrmEntity)
      .findOne({ where: { id: token.userId } });
    if (!user) return null;
    return {
      userId: token.userId,
      email: user.email,
      firstName: user.firstName,
    };
  }

  async consumeAndUpdatePassword(
    tokenHash: string,
    passwordHash: string,
    now: Date,
  ): Promise<ConsumedPasswordReset | null> {
    return this.dataSource.transaction(async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .update(PasswordResetTokenOrmEntity)
        .set({ usedAt: now })
        .where('"tokenHash" = :tokenHash', { tokenHash })
        .andWhere('"usedAt" IS NULL')
        .andWhere('"expiresAt" > timezone(\'utc\', now())')
        .returning(['id', 'userId'])
        .execute();
      const consumedToken = (
        result.raw as Array<{ id?: unknown; userId?: unknown }>
      )[0];
      const tokenId = consumedToken?.id;
      const userId = consumedToken?.userId;
      if (typeof tokenId !== 'string' || typeof userId !== 'string')
        return null;

      const users = manager.getRepository(UserOrmEntity);
      const user = await users.findOne({ where: { id: userId } });
      if (!user) return null;

      await users.update({ id: userId }, { passwordHash });
      await manager.getRepository(PasswordResetTokenOrmEntity).update(
        {
          userId,
          id: Not(tokenId),
          usedAt: IsNull(),
        },
        { usedAt: now },
      );

      return { userId, email: user.email, firstName: user.firstName };
    });
  }
}
