import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Campos do formulário que a regra guarda como lead (nome, e-mail, telefone...). */
export class AddFieldsToTrackingRules1791334590508 implements MigrationInterface {
  name = 'AddFieldsToTrackingRules1791334590508';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tracking_rules"
        ADD COLUMN "fields" jsonb NOT NULL DEFAULT '[]'::jsonb,
        ADD CONSTRAINT "CHK_tracking_rules_fields"
          CHECK (
            jsonb_typeof("fields") = 'array'
            AND jsonb_array_length("fields") <= 20
            AND ("trigger" = 'submit' OR jsonb_array_length("fields") = 0)
          )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tracking_rules"
        DROP CONSTRAINT "CHK_tracking_rules_fields",
        DROP COLUMN "fields"
    `);
  }
}
