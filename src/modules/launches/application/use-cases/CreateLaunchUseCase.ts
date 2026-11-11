import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR } from '../../../../shared/domain/IdGenerator';
import type { IdGenerator } from '../../../../shared/domain/IdGenerator';
import { DomainError } from '../../../../shared/errors/DomainError';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { EXPERTS_REPOSITORY } from '../../../experts/domain/repositories/ExpertsRepository';
import type { ExpertsRepository } from '../../../experts/domain/repositories/ExpertsRepository';
import { Launch } from '../../domain/entities/Launch';
import { LaunchStatus } from '../../domain/enums/LaunchStatus';
import { LaunchType } from '../../domain/enums/LaunchType';
import { LAUNCHES_REPOSITORY } from '../../domain/repositories/LaunchesRepository';
import type { LaunchesRepository } from '../../domain/repositories/LaunchesRepository';
import { requireLaunchAdmin } from '../LaunchAuthorization';
import { validateLaunchDateRange } from '../validateLaunchDateRange';

export type CreateLaunchInput = {
  expertId: string;
  slug?: string;
  type?: LaunchType;
  name: string;
  description?: string;
  status?: LaunchStatus;
  startsAt?: Date;
  endsAt?: Date;
  timezone?: string;
};

@Injectable()
export class CreateLaunchUseCase {
  constructor(
    @Inject(LAUNCHES_REPOSITORY) private readonly launches: LaunchesRepository,
    @Inject(EXPERTS_REPOSITORY) private readonly experts: ExpertsRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(
    input: CreateLaunchInput,
    auth: AccessTokenClaims,
  ): Promise<Launch> {
    const tenantId = requireLaunchAdmin(auth);
    
    const expert = await this.experts.findByTenantIdAndId(
      tenantId,
      input.expertId,
    );

    if (!expert) {
      throw DomainError.expertNotFound();
    }

    validateLaunchDateRange(input.startsAt, input.endsAt);

    const generatedSlug = input.slug === undefined;
    const baseSlug = input.slug ?? slugify(input.name);
    const id = this.ids.generate();
    const now = new Date();
    const slugs = generatedSlug
      ? [
          baseSlug,
          ...[2, 3, 4, 5].map((suffix) => withSuffix(baseSlug, `${suffix}`)),
          withSuffix(baseSlug, randomBytes(3).toString('hex')),
        ]
      : [baseSlug];

    for (const slug of slugs) {
      try {
        return await this.launches.create(
          new Launch({
            id,
            tenantId,
            expertId: input.expertId,
            slug,
            type: input.type ?? LaunchType.OTHER,
            name: input.name,
            description: input.description,
            status: input.status ?? LaunchStatus.DRAFT,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            timezone: input.timezone ?? 'UTC',
            deletedAt: null,
            createdBy: auth.userId,
            updatedBy: auth.userId,
            deletedBy: null,
            version: 1,
            createdAt: now,
            updatedAt: now,
          }),
        );
      } catch (error) {
        if (!generatedSlug || !isSlugConflict(error)) throw error;
      }
    }

    throw new DomainError(409, 'LAUNCH_SLUG_ALREADY_EXISTS');
  }
}

function slugify(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 180)
    .replace(/-$/g, '');

  return slug.length >= 2 ? slug : 'lancamento';
}

function withSuffix(slug: string, suffix: string): string {
  const separatorSuffix = `-${suffix}`;
  const base = slug.slice(0, 180 - separatorSuffix.length).replace(/-+$/g, '');
  return `${base}${separatorSuffix}`;
}

function isSlugConflict(error: unknown): boolean {
  return (
    error instanceof DomainError &&
    error.statusCode === 409 &&
    error.reason === 'LAUNCH_SLUG_ALREADY_EXISTS'
  );
}
