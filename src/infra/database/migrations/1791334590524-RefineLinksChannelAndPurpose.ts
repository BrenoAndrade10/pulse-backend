import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RefineLinksChannelAndPurpose1791334590524 implements MigrationInterface {
  name = 'RefineLinksChannelAndPurpose1791334590524';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "links" DROP CONSTRAINT "CHK_links_channel"',
    );
    await queryRunner.query(
      'ALTER TABLE "links" DROP CONSTRAINT "CHK_links_purpose"',
    );
    await queryRunner.query(`
      UPDATE "links"
      SET "channel" = 'instagram', "placement" = COALESCE("placement", 'bio')
      WHERE "channel" = 'instagram_bio'
    `);
    await queryRunner.query(`
      UPDATE "links"
      SET "channel" = 'instagram', "placement" = COALESCE("placement", 'stories')
      WHERE "channel" = 'instagram_story'
    `);
    await queryRunner.query(`
      UPDATE "links"
      SET "channel" = 'whatsapp', "placement" = COALESCE("placement", 'group')
      WHERE "channel" = 'whatsapp_group'
    `);
    await queryRunner.query(`
      UPDATE "links"
      SET "channel" = 'whatsapp', "placement" = COALESCE("placement", 'private')
      WHERE "channel" = 'whatsapp_private'
    `);
    await queryRunner.query(`
      UPDATE "links" SET "purpose" = 'capture' WHERE "purpose" = 'signup'
    `);
    await queryRunner.query(`
      UPDATE "links" SET "purpose" = 'other' WHERE "purpose" = 'community'
    `);
    await queryRunner.query(`
      ALTER TABLE "links"
      ADD CONSTRAINT "CHK_links_channel"
      CHECK ("channel" IN ('instagram', 'whatsapp', 'telegram', 'email', 'ads', 'other'))
    `);
    await queryRunner.query(`
      ALTER TABLE "links"
      ADD CONSTRAINT "CHK_links_purpose"
      CHECK ("purpose" IN ('content', 'capture', 'event', 'offer', 'checkout', 'other'))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "links" DROP CONSTRAINT "CHK_links_channel"',
    );
    await queryRunner.query(
      'ALTER TABLE "links" DROP CONSTRAINT "CHK_links_purpose"',
    );
    await queryRunner.query(`
      UPDATE "links"
      SET "channel" = CASE WHEN "placement" = 'stories' THEN 'instagram_story' ELSE 'instagram_bio' END
      WHERE "channel" = 'instagram'
    `);
    await queryRunner.query(`
      UPDATE "links"
      SET "channel" = CASE WHEN "placement" = 'private' THEN 'whatsapp_private' ELSE 'whatsapp_group' END
      WHERE "channel" = 'whatsapp'
    `);
    await queryRunner.query(`
      UPDATE "links" SET "purpose" = 'signup' WHERE "purpose" = 'capture'
    `);
    await queryRunner.query(`
      UPDATE "links" SET "purpose" = 'other' WHERE "purpose" IN ('event', 'checkout')
    `);
    await queryRunner.query(`
      ALTER TABLE "links"
      ADD CONSTRAINT "CHK_links_channel"
      CHECK ("channel" IN ('instagram_bio', 'instagram_story', 'whatsapp_group', 'whatsapp_private', 'email', 'telegram', 'ads', 'other'))
    `);
    await queryRunner.query(`
      ALTER TABLE "links"
      ADD CONSTRAINT "CHK_links_purpose"
      CHECK ("purpose" IN ('offer', 'signup', 'content', 'community', 'other'))
    `);
  }
}
