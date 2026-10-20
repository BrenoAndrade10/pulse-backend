import { Injectable } from '@nestjs/common';
import type { DataSource, EntityManager } from 'typeorm';
import type {
  LeadRow,
  LeadsRepository,
  ListLeadsQuery,
  RecordSubmissionInput,
} from '../../domain/repositories/LeadsRepository';

type LockedLead = {
  id: string;
  emailHash: string | null;
  profileEncrypted: string;
  profileIv: string;
  profileAuthTag: string;
};

type RawLeadRow = {
  id: string;
  tenantId: string;
  expertId: string;
  profileEncrypted: string;
  profileIv: string;
  profileAuthTag: string;
  consent: boolean | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  cursorAt: string;
  launches: {
    launchId: string;
    firstSubmittedAt: string;
    lastSubmittedAt: string;
    submissionsCount: number;
    firstUtm: Record<string, string>;
  }[];
};

const LEAD_COLUMNS = `"id", "emailHash", "profileEncrypted", "profileIv", "profileAuthTag"`;

/**
 * SQL direto: travas de linha, ON CONFLICT e a agregação das inscrições na
 * mesma consulta, sem idas e voltas extras ao banco.
 */
@Injectable()
export class PostgresLeadsRepository implements LeadsRepository {
  constructor(private readonly dataSource: DataSource) {}

  async recordSubmission(
    input: RecordSubmissionInput,
  ): Promise<{ leadId: string; duplicate: boolean }> {
    return this.dataSource.transaction(async (manager) => {
      // Reenvio do mesmo evento pelo navegador: não conta de novo.
      const seen = await manager.query<{ leadId: string }[]>(
        `SELECT "leadId" FROM "lead_submissions" WHERE "pixelId" = $1 AND "eventId" = $2`,
        [input.pixelId, input.eventId],
      );
      if (seen.length > 0) return { leadId: seen[0].leadId, duplicate: true };

      const lead = await this.lockOrCreate(manager, input);

      const inserted = await manager.query<unknown[]>(
        `
          INSERT INTO "lead_submissions" (
            "id", "tenantId", "expertId", "leadId", "launchId", "pixelId",
            "ruleId", "eventId", "pageUrl", "utm", "submittedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
          ON CONFLICT ("pixelId", "eventId") DO NOTHING
          RETURNING "id"
        `,
        [
          input.submissionId,
          input.tenantId,
          input.expertId,
          lead.id,
          input.launchId,
          input.pixelId,
          input.ruleId,
          input.eventId,
          input.pageUrl,
          JSON.stringify(input.utm),
          input.submittedAt,
        ],
      );
      if (inserted.length === 0) return { leadId: lead.id, duplicate: true };

      if (input.launchId) {
        await manager.query(
          `
            INSERT INTO "lead_launches" (
              "leadId", "launchId", "tenantId", "expertId",
              "firstSubmittedAt", "lastSubmittedAt", "submissionsCount", "firstUtm"
            ) VALUES ($1, $2, $3, $4, $5, $5, 1, $6::jsonb)
            ON CONFLICT ("leadId", "launchId") DO UPDATE SET
              "lastSubmittedAt" = GREATEST("lead_launches"."lastSubmittedAt", EXCLUDED."lastSubmittedAt"),
              "submissionsCount" = "lead_launches"."submissionsCount" + 1
          `,
          [
            lead.id,
            input.launchId,
            input.tenantId,
            input.expertId,
            input.submittedAt,
            JSON.stringify(input.utm),
          ],
        );
      }

      return { leadId: lead.id, duplicate: false };
    });
  }

  /** Acha a pessoa (travando a linha) ou cria o lead; depois junta os dados. */
  private async lockOrCreate(
    manager: EntityManager,
    input: RecordSubmissionInput,
  ): Promise<LockedLead> {
    let lead = await this.findForUpdate(manager, input);

    if (!lead) {
      const profile = input.mergeProfile(input.newLeadId, null);
      const created = await manager.query<LockedLead[]>(
        `
          INSERT INTO "leads" (
            "id", "tenantId", "expertId", "emailHash", "phoneHash",
            "profileEncrypted", "profileIv", "profileAuthTag", "consent",
            "firstSeenAt", "lastSeenAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
          ON CONFLICT DO NOTHING
          RETURNING ${LEAD_COLUMNS}
        `,
        [
          input.newLeadId,
          input.tenantId,
          input.expertId,
          input.emailHash,
          input.phoneHash,
          profile.encryptedValue,
          profile.iv,
          profile.authTag,
          input.consent ?? null,
          input.submittedAt,
        ],
      );

      if (created.length > 0) return created[0];

      // Outro envio da mesma pessoa criou o lead no mesmo instante.
      lead = await this.findForUpdate(manager, input);
      if (!lead) throw new Error('Lead não encontrado depois do conflito.');
    }

    const profile = input.mergeProfile(lead.id, {
      encryptedValue: lead.profileEncrypted,
      iv: lead.profileIv,
      authTag: lead.profileAuthTag,
    });

    await manager.query(
      `
        UPDATE "leads" SET
          "emailHash" = COALESCE("emailHash", $2),
          "phoneHash" = COALESCE($3, "phoneHash"),
          "profileEncrypted" = $4,
          "profileIv" = $5,
          "profileAuthTag" = $6,
          "consent" = COALESCE($7, "consent"),
          "lastSeenAt" = GREATEST("lastSeenAt", $8),
          "updatedAt" = timezone('utc', now())
        WHERE "id" = $1
      `,
      [
        lead.id,
        input.emailHash,
        input.phoneHash,
        profile.encryptedValue,
        profile.iv,
        profile.authTag,
        input.consent ?? null,
        input.submittedAt,
      ],
    );

    return lead;
  }

  /**
   * Pelo e-mail; sem e-mail, pelo telefone. Com e-mail novo mas telefone já
   * conhecido num lead sem e-mail, é a mesma pessoa completando o cadastro.
   */
  private async findForUpdate(
    manager: EntityManager,
    input: RecordSubmissionInput,
  ): Promise<LockedLead | null> {
    const owner = [input.tenantId, input.expertId];

    if (input.emailHash) {
      const byEmail = await manager.query<LockedLead[]>(
        `SELECT ${LEAD_COLUMNS} FROM "leads"
         WHERE "tenantId" = $1 AND "expertId" = $2 AND "emailHash" = $3
         FOR UPDATE`,
        [...owner, input.emailHash],
      );
      if (byEmail[0]) return byEmail[0];

      if (!input.phoneHash) return null;
      const phoneOnly = await manager.query<LockedLead[]>(
        `SELECT ${LEAD_COLUMNS} FROM "leads"
         WHERE "tenantId" = $1 AND "expertId" = $2 AND "phoneHash" = $3 AND "emailHash" IS NULL
         FOR UPDATE`,
        [...owner, input.phoneHash],
      );
      return phoneOnly[0] ?? null;
    }

    const byPhone = await manager.query<LockedLead[]>(
      `SELECT ${LEAD_COLUMNS} FROM "leads"
       WHERE "tenantId" = $1 AND "expertId" = $2 AND "phoneHash" = $3
       ORDER BY "lastSeenAt" DESC
       LIMIT 1
       FOR UPDATE`,
      [...owner, input.phoneHash],
    );
    return byPhone[0] ?? null;
  }

  async list(query: ListLeadsQuery): Promise<LeadRow[]> {
    const { where, params } = this.filters(query);

    if (query.after) {
      params.push(query.after.lastSeenAt, query.after.id);
      where.push(
        `(l."lastSeenAt", l."id") < ($${params.length - 1}::timestamp, $${params.length}::uuid)`,
      );
    }
    params.push(query.limit);

    const rows = await this.dataSource.query<RawLeadRow[]>(
      `
        SELECT l."id", l."tenantId", l."expertId", l."profileEncrypted",
               l."profileIv", l."profileAuthTag", l."consent",
               l."firstSeenAt", l."lastSeenAt",
               to_char(l."lastSeenAt", 'YYYY-MM-DD"T"HH24:MI:SS.US') AS "cursorAt",
               COALESCE(
                 json_agg(
                   json_build_object(
                     'launchId', ll."launchId",
                     'firstSubmittedAt', ll."firstSubmittedAt",
                     'lastSubmittedAt', ll."lastSubmittedAt",
                     'submissionsCount', ll."submissionsCount",
                     'firstUtm', ll."firstUtm"
                   ) ORDER BY ll."firstSubmittedAt"
                 ) FILTER (WHERE ll."leadId" IS NOT NULL),
                 '[]'
               ) AS "launches"
        FROM "leads" l
        LEFT JOIN "lead_launches" ll ON ll."leadId" = l."id"
        WHERE ${where.join(' AND ')}
        GROUP BY l."id"
        ORDER BY l."lastSeenAt" DESC, l."id" DESC
        LIMIT $${params.length}
      `,
      params,
    );

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      expertId: row.expertId,
      profile: {
        encryptedValue: row.profileEncrypted,
        iv: row.profileIv,
        authTag: row.profileAuthTag,
      },
      consent: row.consent,
      firstSeenAt: row.firstSeenAt,
      lastSeenAt: row.lastSeenAt,
      cursor: { lastSeenAt: row.cursorAt, id: row.id },
      launches: row.launches.map((launch) => ({
        launchId: launch.launchId,
        firstSubmittedAt: new Date(launch.firstSubmittedAt),
        lastSubmittedAt: new Date(launch.lastSubmittedAt),
        submissionsCount: launch.submissionsCount,
        firstUtm: launch.firstUtm ?? {},
      })),
    }));
  }

  async launchNames(
    tenantId: string,
    expertId: string,
  ): Promise<Map<string, string>> {
    const rows = await this.dataSource.query<{ id: string; name: string }[]>(
      `SELECT "id", "name" FROM "launches" WHERE "tenantId" = $1 AND "expertId" = $2`,
      [tenantId, expertId],
    );
    return new Map(rows.map((row) => [row.id, row.name]));
  }

  async customFieldLabels(
    tenantId: string,
    expertId: string,
  ): Promise<string[]> {
    const rows = await this.dataSource.query<{ label: string }[]>(
      `
        SELECT DISTINCT field->>'label' AS "label"
        FROM "tracking_rules" r, jsonb_array_elements(r."fields") AS field
        WHERE r."tenantId" = $1 AND r."expertId" = $2 AND field->>'key' = 'custom'
        ORDER BY 1
      `,
      [tenantId, expertId],
    );
    return rows.map((row) => row.label).filter(Boolean);
  }

  async count(query: Omit<ListLeadsQuery, 'after' | 'limit'>): Promise<number> {
    const { where, params } = this.filters(query);
    const [row] = await this.dataSource.query<{ count: number }[]>(
      `SELECT COUNT(*)::int AS "count" FROM "leads" l WHERE ${where.join(' AND ')}`,
      params,
    );
    return row?.count ?? 0;
  }

  async delete(
    tenantId: string,
    expertId: string,
    leadId: string,
  ): Promise<boolean> {
    const result = await this.dataSource.query<[unknown[], number] | unknown[]>(
      `DELETE FROM "leads" WHERE "tenantId" = $1 AND "expertId" = $2 AND "id" = $3 RETURNING "id"`,
      [tenantId, expertId, leadId],
    );
    const rows = Array.isArray(result[0]) ? result[0] : result;
    return rows.length > 0;
  }

  private filters(query: Omit<ListLeadsQuery, 'after' | 'limit'>) {
    const params: unknown[] = [query.tenantId, query.expertId];
    const where = [`l."tenantId" = $1`, `l."expertId" = $2`];

    if (query.launchId) {
      params.push(query.launchId);
      where.push(
        `EXISTS (SELECT 1 FROM "lead_launches" x WHERE x."leadId" = l."id" AND x."launchId" = $${params.length})`,
      );
    }
    if (query.emailHash) {
      params.push(query.emailHash);
      where.push(`l."emailHash" = $${params.length}`);
    }
    if (query.phoneHash) {
      params.push(query.phoneHash);
      where.push(`l."phoneHash" = $${params.length}`);
    }

    return { where, params };
  }
}
