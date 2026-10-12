import { Injectable } from '@nestjs/common';
import { User } from '../../domain/entities/User';
import { UsersRepository } from '../../domain/repositories/UsersRepository';

@Injectable()
export class InMemoryUsersRepository implements UsersRepository {
  private readonly users: User[] = [];

  create(user: User): Promise<User> {
    this.users.push(user);

    return Promise.resolve(user);
  }

  findByEmail(email: string): Promise<User | null> {
    const user = this.users.find((currentUser) => currentUser.email === email);

    return Promise.resolve(user ?? null);
  }
}
