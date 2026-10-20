import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Resultado da resposta pública ao comentário, quando a regra tem uma. */
export class AddPublicReplyToCommentReplies1791334590505 implements MigrationInterface {
  name = 'AddPublicReplyToCommentReplies1791334590505';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "instagram_comment_replies"
        ADD COLUMN "publicReplyStatus" varchar(16),
        ADD COLUMN "publicReplyError" varchar(64),
        ADD CONSTRAINT "CHK_instagram_comment_replies_public_reply_status"
          CHECK ("publicReplyStatus" IS NULL OR "publicReplyStatus" IN ('sent', 'failed'))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "instagram_comment_replies"
        DROP CONSTRAINT "CHK_instagram_comment_replies_public_reply_status",
        DROP COLUMN "publicReplyError",
        DROP COLUMN "publicReplyStatus"
    `);
  }
}
