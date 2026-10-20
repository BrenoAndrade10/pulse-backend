import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Regra de DM automática por Reel: comentário com uma das palavras-chave
 * recebe a mensagem como resposta privada. Uma regra por expert e mídia.
 */
export class CreateInstagramCommentAutomations1791334590502 implements MigrationInterface {
  name = 'CreateInstagramCommentAutomations1791334590502';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "instagram_comment_automations" (
        "id" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "expertId" uuid NOT NULL,
        "mediaId" varchar(64) NOT NULL,
        "keywords" jsonb NOT NULL,
        "message" text NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        "updatedAt" timestamp NOT NULL DEFAULT timezone('utc', now()),
        CONSTRAINT "PK_instagram_comment_automations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_instagram_comment_automations_media"
          UNIQUE ("tenantId", "expertId", "mediaId"),
        CONSTRAINT "FK_instagram_comment_automations_tenant"
          FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_instagram_comment_automations_expert"
          FOREIGN KEY ("expertId") REFERENCES "experts"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_instagram_comment_automations_keywords"
          CHECK (
            jsonb_typeof("keywords") = 'array'
            AND jsonb_array_length("keywords") BETWEEN 1 AND 10
          ),
        -- 1000 caracteres: limite de texto de uma mensagem no Direct.
        CONSTRAINT "CHK_instagram_comment_automations_message"
          CHECK (char_length("message") BETWEEN 1 AND 1000)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "instagram_comment_automations"');
  }
}
