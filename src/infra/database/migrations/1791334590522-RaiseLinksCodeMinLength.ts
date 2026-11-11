import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RaiseLinksCodeMinLength1791334590522 implements MigrationInterface {
  name = 'RaiseLinksCodeMinLength1791334590522';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "links"
      DROP CONSTRAINT "CHK_links_code_format"
    `);

    await queryRunner.query(`
      ALTER TABLE "links"
      ADD CONSTRAINT "CHK_links_code_format"
      CHECK ("code" ~ '^[a-z0-9]{7,16}$')
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "links"
      DROP CONSTRAINT "CHK_links_code_format"
    `);

    await queryRunner.query(`
      ALTER TABLE "links"
      ADD CONSTRAINT "CHK_links_code_format"
      CHECK ("code" ~ '^[a-z0-9]{4,16}$')
    `);
  }
}
