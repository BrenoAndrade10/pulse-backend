import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ValidationError } from 'yup';
import { DomainError } from '../../../../shared/errors/DomainError';
import { isUuidV7 } from '../../../../shared/presentation/validators/isUuidV7';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { CurrentAuth } from '../../../auth/presentation/decorators/CurrentAuth';
import { CreateExpertUseCase } from '../../application/use-cases/CreateExpertUseCase';
import { DeleteExpertUseCase } from '../../application/use-cases/DeleteExpertUseCase';
import { ListExpertsUseCase } from '../../application/use-cases/ListExpertsUseCase';
import { UpdateExpertUseCase } from '../../application/use-cases/UpdateExpertUseCase';
import type { Expert } from '../../domain/entities/Expert';
import {
  createExpertSchema,
  type CreateExpertSchemaInput,
  updateExpertSchema,
  type UpdateExpertSchemaInput,
} from '../schemas/ExpertSchemas';

@Controller('experts')
export class ExpertsController {
  constructor(
    private readonly createExpert: CreateExpertUseCase,
    private readonly listExperts: ListExpertsUseCase,
    private readonly updateExpert: UpdateExpertUseCase,
    private readonly deleteExpert: DeleteExpertUseCase,
  ) {}

  @Post()
  async create(@Body() body: unknown, @CurrentAuth() auth: AccessTokenClaims) {
    const input = await this.validate<CreateExpertSchemaInput>(
      createExpertSchema,
      body,
    );
    return this.toResponse(await this.createExpert.execute(input, auth));
  }

  @Get()
  async list(@CurrentAuth() auth: AccessTokenClaims) {
    const experts = await this.listExperts.execute(auth);
    return experts.map((expert) => this.toResponse(expert));
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentAuth() auth: AccessTokenClaims,
  ) {
    this.validateId(id);
    const input = await this.validate<UpdateExpertSchemaInput>(
      updateExpertSchema,
      body,
    );
    return this.toResponse(await this.updateExpert.execute(id, input, auth));
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(
    @Param('id') id: string,
    @CurrentAuth() auth: AccessTokenClaims,
  ): Promise<void> {
    this.validateId(id);
    await this.deleteExpert.execute(id, auth);
  }

  private validateId(id: string): void {
    if (!isUuidV7(id)) {
      throw DomainError.validationFailed({ errors: ['Informe um id válido.'] });
    }
  }

  private async validate<T>(
    schema: { validate(value: unknown, options: object): Promise<T> },
    body: unknown,
  ): Promise<T> {
    try {
      return await schema.validate(body, {
        abortEarly: false,
        stripUnknown: false,
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw DomainError.validationFailed({ errors: error.errors });
      }
      throw error;
    }
  }

  private toResponse(expert: Expert) {
    return {
      id: expert.id,
      name: expert.name,
      commercialName: expert.commercialName ?? null,
      email: expert.email,
      status: expert.status,
      createdAt: expert.createdAt,
      updatedAt: expert.updatedAt,
    };
  }
}
