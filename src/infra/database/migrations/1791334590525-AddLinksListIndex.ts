import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLinksListIndex1791334590525 implements MigrationInterface {
  name = 'AddLinksListIndex1791334590525';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX "IDX_links_tenant_created" ON "links" ("tenantId", "createdAt" DESC, "id" DESC) WHERE "deletedAt" IS NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_links_tenant_created"');
  }
}
