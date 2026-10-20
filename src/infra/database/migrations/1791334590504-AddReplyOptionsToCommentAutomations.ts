import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Botão de link na DM e resposta pública ao comentário, ambos opcionais.
 * Com botão, a DM vira template da Meta, que aceita até 640 caracteres.
 */
export class AddReplyOptionsToCommentAutomations1791334590504 implements MigrationInterface {
  name = 'AddReplyOptionsToCommentAutomations1791334590504';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "instagram_comment_automations"
        ADD COLUMN "buttonLabel" varchar(20),
        ADD COLUMN "buttonUrl" varchar(2000),
        ADD COLUMN "commentReply" text,
        ADD CONSTRAINT "CHK_instagram_comment_automations_button"
          CHECK (
            ("buttonLabel" IS NULL) = ("buttonUrl" IS NULL)
            AND ("buttonUrl" IS NULL OR "buttonUrl" LIKE 'https://%')
            AND ("buttonLabel" IS NULL OR char_length("message") <= 640)
          ),
        ADD CONSTRAINT "CHK_instagram_comment_automations_comment_reply"
          CHECK (
            "commentReply" IS NULL
            OR char_length("commentReply") BETWEEN 1 AND 2200
          )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "instagram_comment_automations"
        DROP CONSTRAINT "CHK_instagram_comment_automations_comment_reply",
        DROP CONSTRAINT "CHK_instagram_comment_automations_button",
        DROP COLUMN "commentReply",
        DROP COLUMN "buttonUrl",
        DROP COLUMN "buttonLabel"
    `);
  }
}
