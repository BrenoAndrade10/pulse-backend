import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTenantsTenantUsersExperts1791334590494 implements MigrationInterface {
  name = 'CreateTenantsTenantUsersExperts1791334590494';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tenants" (
        "id" uuid NOT NULL,
        "name" varchar(180) NOT NULL,
        "status" varchar(50) NOT NULL DEFAULT 'active',
        "createdAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        "updatedAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        CONSTRAINT "PK_tenants" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tenants_name" UNIQUE ("name")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tenants_status"
      ON "tenants" ("status")
    `);

    await queryRunner.query(`
      CREATE TABLE "tenant_users" (
        "id" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "role" varchar(50) NOT NULL DEFAULT 'member',
        "createdAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        "updatedAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        CONSTRAINT "PK_tenant_users" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tenant_users_tenant"
          FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_tenant_users_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_tenant_users_tenant_user"
      ON "tenant_users" ("tenantId", "userId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tenant_users_user"
      ON "tenant_users" ("userId")
    `);

    await queryRunner.query(`
      CREATE TABLE "experts" (
        "id" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "name" varchar(180) NOT NULL,
        "commercialName" varchar(180),
        "email" varchar(255) NOT NULL,
        "status" varchar(50) NOT NULL DEFAULT 'active',
        "createdAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        "updatedAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        CONSTRAINT "PK_experts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_experts_tenant"
          FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_experts_tenant_status"
      ON "experts" ("tenantId", "status")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_experts_tenant_email"
      ON "experts" ("tenantId", "email")
    `);

    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN "role"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_expert_meta_credentials_expert_active"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_expert_meta_credentials_instagram_user"
    `);

    await queryRunner.query(`
      ALTER TABLE "expert_meta_credentials"
      ADD COLUMN "tenantId" uuid NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "expert_meta_credentials"
      ADD CONSTRAINT "FK_expert_meta_credentials_tenant"
        FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
        ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "expert_meta_credentials"
      ADD CONSTRAINT "FK_expert_meta_credentials_expert"
        FOREIGN KEY ("expertId") REFERENCES "experts"("id")
        ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_expert_meta_credentials_tenant_expert_active"
      ON "expert_meta_credentials" ("tenantId", "expertId", "isActive")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_expert_meta_credentials_tenant_instagram_user"
      ON "expert_meta_credentials" ("tenantId", "instagramUserId")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "IDX_expert_meta_credentials_tenant_instagram_user"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_expert_meta_credentials_tenant_expert_active"
    `);

    await queryRunner.query(`
      ALTER TABLE "expert_meta_credentials"
      DROP CONSTRAINT "FK_expert_meta_credentials_expert"
    `);

    await queryRunner.query(`
      ALTER TABLE "expert_meta_credentials"
      DROP CONSTRAINT "FK_expert_meta_credentials_tenant"
    `);

    await queryRunner.query(`
      ALTER TABLE "expert_meta_credentials" DROP COLUMN "tenantId"
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_expert_meta_credentials_instagram_user"
      ON "expert_meta_credentials" ("instagramUserId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_expert_meta_credentials_expert_active"
      ON "expert_meta_credentials" ("expertId", "isActive")
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "role" varchar(50) NOT NULL DEFAULT 'member'
    `);

    await queryRunner.query('DROP INDEX "IDX_experts_tenant_email"');
    await queryRunner.query('DROP INDEX "IDX_experts_tenant_status"');
    await queryRunner.query('DROP TABLE "experts"');
    await queryRunner.query('DROP INDEX "IDX_tenant_users_user"');
    await queryRunner.query('DROP INDEX "IDX_tenant_users_tenant_user"');
    await queryRunner.query('DROP TABLE "tenant_users"');
    await queryRunner.query('DROP INDEX "IDX_tenants_status"');
    await queryRunner.query('DROP TABLE "tenants"');
  }
}
