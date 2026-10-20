import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLaunchPlanningFields1791334590497 implements MigrationInterface {
  name = 'AddLaunchPlanningFields1791334590497';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "launches"
        ADD COLUMN "plannedBudget" numeric(15, 2),
        ADD COLUMN "revenueGoal" numeric(15, 2),
        ADD COLUMN "leadGoal" integer,
        ADD COLUMN "salesGoal" integer,
        ADD COLUMN "currency" varchar(3),
        ADD COLUMN "startedAt" timestamptz,
        ADD COLUMN "completedAt" timestamptz
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "launches"
        DROP COLUMN "completedAt",
        DROP COLUMN "startedAt",
        DROP COLUMN "currency",
        DROP COLUMN "salesGoal",
        DROP COLUMN "leadGoal",
        DROP COLUMN "revenueGoal",
        DROP COLUMN "plannedBudget"
    `);
  }
}
