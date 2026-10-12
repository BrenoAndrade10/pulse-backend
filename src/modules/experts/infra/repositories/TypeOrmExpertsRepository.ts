import { Injectable } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { Expert } from '../../domain/entities/Expert';
import { ExpertsRepository } from '../../domain/repositories/ExpertsRepository';
import { ExpertOrmEntity } from '../entities/ExpertOrmEntity';
import { ExpertMapper } from '../mappers/ExpertMapper';

@Injectable()
export class TypeOrmExpertsRepository implements ExpertsRepository {
  constructor(private readonly repository: Repository<ExpertOrmEntity>) {}

  async create(expert: Expert): Promise<Expert> {
    const entity = ExpertMapper.toPersistence(expert);
    const savedExpert = await this.repository.save(entity);

    return ExpertMapper.toDomain(savedExpert);
  }

  async findById(id: string): Promise<Expert | null> {
    const expert = await this.repository.findOne({ where: { id } });

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
}
