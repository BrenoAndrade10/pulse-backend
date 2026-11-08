import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWebinarLaunchType1791334590518 implements MigrationInterface {
  name = 'AddWebinarLaunchType1791334590518';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "launches"
        DROP CONSTRAINT "CHK_launches_type",
        ADD CONSTRAINT "CHK_launches_type"
          CHECK ("type" IN ('seed', 'internal', 'perpetual', 'webinar', 'other'))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "launches" SET "type" = 'other' WHERE "type" = 'webinar'
    `);
    await queryRunner.query(`
      ALTER TABLE "launches"
        DROP CONSTRAINT "CHK_launches_type",
        ADD CONSTRAINT "CHK_launches_type"
          CHECK ("type" IN ('seed', 'internal', 'perpetual', 'other'))
    `);
  }
}
