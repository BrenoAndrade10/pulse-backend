import { Injectable } from '@nestjs/common';
import { QueryFailedError, type Repository } from 'typeorm';
import { DomainError } from '../../../../shared/errors/DomainError';
import { Expert } from '../../domain/entities/Expert';
import { ExpertsRepository } from '../../domain/repositories/ExpertsRepository';
import { ExpertOrmEntity } from '../entities/ExpertOrmEntity';
import { ExpertMapper } from '../mappers/ExpertMapper';

@Injectable()
export class TypeOrmExpertsRepository implements ExpertsRepository {
  constructor(private readonly repository: Repository<ExpertOrmEntity>) {}

  async create(expert: Expert): Promise<Expert> {
    return this.persist(expert);
  }

  async save(expert: Expert): Promise<Expert> {
    return this.persist(expert);
  }

  private async persist(expert: Expert): Promise<Expert> {
    const entity = ExpertMapper.toPersistence(expert);
    let savedExpert: ExpertOrmEntity;

    try {
      savedExpert = await this.repository.save(entity);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { constraint?: string }).constraint ===
          'IDX_experts_tenant_email'
      ) {
        throw new DomainError(409, 'EXPERT_EMAIL_ALREADY_EXISTS');
      }
      throw error;
    }

    return ExpertMapper.toDomain(savedExpert);
  }

  async findById(id: string): Promise<Expert | null> {
    const expert = await this.repository.findOne({ where: { id } });
    return expert ? ExpertMapper.toDomain(expert) : null;
  }

  async findByTenantIdAndId(
    tenantId: string,
    id: string,
  ): Promise<Expert | null> {
    const expert = await this.repository.findOne({ where: { tenantId, id } });

    return expert ? ExpertMapper.toDomain(expert) : null;
  }

  async findByTenantIdAndEmail(
    tenantId: string,
    email: string,
  ): Promise<Expert | null> {
    const expert = await this.repository.findOne({
      where: { tenantId, email },
    });

    return expert ? ExpertMapper.toDomain(expert) : null;
  }

  async findByTenantId(tenantId: string): Promise<Expert[]> {
    const experts = await this.repository.find({
      where: {
        tenantId,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    return experts.map((expert) => ExpertMapper.toDomain(expert));
  }

  async deleteByTenantIdAndId(tenantId: string, id: string): Promise<boolean> {
    const result = await this.repository.delete({ tenantId, id });

    return (result.affected ?? 0) > 0;
  }
}
