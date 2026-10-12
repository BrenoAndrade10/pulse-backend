import { Injectable } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { ExpertMetaCredential } from '../../domain/entities/ExpertMetaCredential';
import { ExpertMetaCredentialsRepository } from '../../domain/repositories/ExpertMetaCredentialsRepository';
import { ExpertMetaCredentialOrmEntity } from '../entities/ExpertMetaCredentialOrmEntity';
import { ExpertMetaCredentialMapper } from '../mappers/ExpertMetaCredentialMapper';

@Injectable()
export class TypeOrmExpertMetaCredentialsRepository implements ExpertMetaCredentialsRepository {
  constructor(
    private readonly repository: Repository<ExpertMetaCredentialOrmEntity>,
  ) {}

  async create(
    credential: ExpertMetaCredential,
  ): Promise<ExpertMetaCredential> {
    const entity = ExpertMetaCredentialMapper.toPersistence(credential);
    const savedCredential = await this.repository.save(entity);

    return ExpertMetaCredentialMapper.toDomain(savedCredential);
  }

  async replaceActive(
    credential: ExpertMetaCredential,
  ): Promise<ExpertMetaCredential> {
    const entity = ExpertMetaCredentialMapper.toPersistence(credential);

    const saved = await this.repository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(ExpertMetaCredentialOrmEntity);

      await repository.update(
        {
          tenantId: credential.tenantId,
          expertId: credential.expertId,
          isActive: true,
        },
        { isActive: false },
      );

      return repository.save(entity);
    });

    return ExpertMetaCredentialMapper.toDomain(saved);
  }

  async findActiveByExpertId(
    tenantId: string,
    expertId: string,
  ): Promise<ExpertMetaCredential | null> {
    const credential = await this.repository.findOne({
      where: {
        tenantId,
        expertId,
        isActive: true,
      },
    });

    return credential ? ExpertMetaCredentialMapper.toDomain(credential) : null;
  }

  async findByInstagramUserId(
    tenantId: string,
    instagramUserId: string,
  ): Promise<ExpertMetaCredential | null> {
    const credential = await this.repository.findOne({
      where: {
        tenantId,
        instagramUserId,
      },
    });

    return credential ? ExpertMetaCredentialMapper.toDomain(credential) : null;
  }
}
