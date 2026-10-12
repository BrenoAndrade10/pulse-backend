import { Body, Controller, Post } from '@nestjs/common';
import { ValidationError } from 'yup';
import { DomainError } from '../../../../shared/errors/DomainError';
import { Public } from '../../../../shared/presentation/decorators/Public';
import { RegisterTenantUserUseCase } from '../../application/use-cases/RegisterTenantUserUseCase';
import { User } from '../../domain/entities/User';
import {
  registerTenantUserSchema,
  type RegisterTenantUserSchemaInput,
} from '../schemas/RegisterTenantUserSchema';

@Controller('users')
export class UsersController {
  constructor(
    private readonly registerTenantUserUseCase: RegisterTenantUserUseCase,
  ) {}

  @Public()
  @Post()
  async create(@Body() body: RegisterTenantUserSchemaInput) {
    const input = await this.validateRegisterTenantUserInput(body);
    const user = await this.registerTenantUserUseCase.execute(input);

    return this.toResponse(user);
  }

  private async validateRegisterTenantUserInput(
    body: RegisterTenantUserSchemaInput,
  ): Promise<RegisterTenantUserSchemaInput> {
    try {
      return await registerTenantUserSchema.validate(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw DomainError.validationFailed({ errors: error.errors });
      }

      throw error;
    }
  }

  private toResponse(user: User) {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
