import { Injectable } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { User } from '../../domain/entities/User';
import { UsersRepository } from '../../domain/repositories/UsersRepository';
import { UserOrmEntity } from '../entities/UserOrmEntity';
import { UserMapper } from '../mappers/UserMapper';

@Injectable()
export class TypeOrmUsersRepository implements UsersRepository {
  constructor(private readonly repository: Repository<UserOrmEntity>) {}

  async create(user: User): Promise<User> {
    const entity = UserMapper.toPersistence(user);
    const savedUser = await this.repository.save(entity);

    return UserMapper.toDomain(savedUser);
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.repository.findOne({
      where: {
        email,
      },
    });

    return user ? UserMapper.toDomain(user) : null;
  }

  async findById(userId: string): Promise<User | null> {
    const user = await this.repository.findOne({ where: { id: userId } });
    return user ? UserMapper.toDomain(user) : null;
  }
}
