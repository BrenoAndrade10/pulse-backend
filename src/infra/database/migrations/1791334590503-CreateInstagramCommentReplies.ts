import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Registro de cada DM automática. O índice único por comentário garante uma
 * só mensagem por comentário, mesmo quando a Meta reenvia o webhook.
 *
 * Não guarda o texto do comentário: só ids e a palavra-chave que disparou.
 */
export class CreateInstagramCommentReplies1791334590503 implements MigrationInterface {
  name = 'CreateInstagramCommentReplies1791334590503';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "instagram_comment_replies" (
        "id" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "expertId" uuid NOT NULL,
        "automationId" uuid,
        "mediaId" varchar(64) NOT NULL,
        "commentId" varchar(64) NOT NULL,
        "commenterId" varchar(64) NOT NULL,
        "matchedKeyword" varchar(50) NOT NULL,
        "status" varchar(16) NOT NULL,
        "errorReason" varchar(64),
        "sentAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        "updatedAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        CONSTRAINT "PK_instagram_comment_replies" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_instagram_comment_replies_comment"
          UNIQUE ("tenantId", "expertId", "commentId"),
        CONSTRAINT "FK_instagram_comment_replies_tenant"
          FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_instagram_comment_replies_expert"
          FOREIGN KEY ("expertId") REFERENCES "experts"("id") ON DELETE CASCADE,
        -- Excluir a regra mantém o histórico (e a proteção contra DM repetida).
        CONSTRAINT "FK_instagram_comment_replies_automation"
          FOREIGN KEY ("automationId")
          REFERENCES "instagram_comment_automations"("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_instagram_comment_replies_status"
          CHECK ("status" IN ('pending', 'sent', 'failed')),
        CONSTRAINT "CHK_instagram_comment_replies_sent_at"
          CHECK (("status" = 'sent') = ("sentAt" IS NOT NULL))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_instagram_comment_replies_automation_sent"
      ON "instagram_comment_replies" ("automationId")
      WHERE "status" = 'sent'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "instagram_comment_replies"');
  }
}
