import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ValidationError } from 'yup';
import { DomainError } from '../../../../shared/errors/DomainError';
import { isUuidV7 } from '../../../../shared/presentation/validators/isUuidV7';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { CurrentAuth } from '../../../auth/presentation/decorators/CurrentAuth';
import { CreateLaunchUseCase } from '../../application/use-cases/CreateLaunchUseCase';
import { DeleteLaunchUseCase } from '../../application/use-cases/DeleteLaunchUseCase';
import { GetLaunchUseCase } from '../../application/use-cases/GetLaunchUseCase';
import { ListLaunchesUseCase } from '../../application/use-cases/ListLaunchesUseCase';
import { UpdateLaunchUseCase } from '../../application/use-cases/UpdateLaunchUseCase';
import type { Launch } from '../../domain/entities/Launch';
import {
  createLaunchSchema,
  type CreateLaunchSchemaInput,
  updateLaunchSchema,
  type UpdateLaunchSchemaInput,
} from '../schemas/LaunchSchemas';

@Controller('launches')
export class LaunchesController {
  constructor(
    private readonly createLaunch: CreateLaunchUseCase,
    private readonly listLaunches: ListLaunchesUseCase,
    private readonly getLaunch: GetLaunchUseCase,
    private readonly updateLaunch: UpdateLaunchUseCase,
    private readonly deleteLaunch: DeleteLaunchUseCase,
  ) {}

  @Get()
  async list(
    @Query('expertId') expertId: string,
    @CurrentAuth() auth: AccessTokenClaims,
  ) {
    this.validateId(expertId);
    return (await this.listLaunches.execute(expertId, auth)).map((launch) =>
      this.toResponse(launch),
    );
  }

  @Get(':id')
  async get(@Param('id') id: string, @CurrentAuth() auth: AccessTokenClaims) {
    this.validateId(id);
    return this.toResponse(await this.getLaunch.execute(id, auth));
  }

  @Post()
  async create(@Body() body: unknown, @CurrentAuth() auth: AccessTokenClaims) {
    const input = await this.validate<CreateLaunchSchemaInput>(
      createLaunchSchema,
      body,
    );
    const launch = await this.createLaunch.execute(
      {
        ...input,
        description: input.description ?? undefined,
        startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
        endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
      },
      auth,
    );
    return this.toResponse(launch);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentAuth() auth: AccessTokenClaims,
  ) {
    this.validateId(id);
    const input = await this.validate<UpdateLaunchSchemaInput>(
      updateLaunchSchema,
      body,
    );
    const launch = await this.updateLaunch.execute(
      id,
      {
        ...input,
        startsAt:
          input.startsAt === null
            ? null
            : input.startsAt
              ? new Date(input.startsAt)
              : undefined,
        endsAt:
          input.endsAt === null
            ? null
            : input.endsAt
              ? new Date(input.endsAt)
              : undefined,
      },
      auth,
    );
    return this.toResponse(launch);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(
    @Param('id') id: string,
    @CurrentAuth() auth: AccessTokenClaims,
  ): Promise<void> {
    this.validateId(id);
    await this.deleteLaunch.execute(id, auth);
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

  private toResponse(launch: Launch) {
    return {
      id: launch.id,
      expertId: launch.expertId,
      slug: launch.slug,
      type: launch.type,
      name: launch.name,
      description: launch.description ?? null,
      status: launch.status,
      startsAt: launch.startsAt ?? null,
      endsAt: launch.endsAt ?? null,
      timezone: launch.timezone,
      createdBy: launch.createdBy,
      updatedBy: launch.updatedBy,
      version: launch.version,
      createdAt: launch.createdAt,
      updatedAt: launch.updatedAt,
    };
  }
}
