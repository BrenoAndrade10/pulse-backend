import { Injectable } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type {
  TrackingPageLaunch,
  TrackingPagesRepository,
} from '../../domain/repositories/TrackingPagesRepository';

@Injectable()
export class PostgresTrackingPagesRepository implements TrackingPagesRepository {
  constructor(private readonly dataSource: DataSource) {}

  async setLaunch(page: TrackingPageLaunch): Promise<void> {
    await this.dataSource.query(
      `
        INSERT INTO "tracking_pages" ("id", "tenantId", "expertId", "pixelId", "pageUrl", "launchId")
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT ("pixelId", "pageUrl") DO UPDATE SET
          "launchId" = EXCLUDED."launchId",
          "updatedAt" = timezone('utc', now())
      `,
      [
        page.id,
        page.tenantId,
        page.expertId,
        page.pixelId,
        page.pageUrl,
        page.launchId,
      ],
    );
  }

  async launchesByPage(pixelId: string): Promise<Map<string, string | null>> {
    const rows = await this.dataSource.query<
      { pageUrl: string; launchId: string | null }[]
    >(
      `SELECT "pageUrl", "launchId" FROM "tracking_pages" WHERE "pixelId" = $1`,
      [pixelId],
    );
    return new Map(rows.map((row) => [row.pageUrl, row.launchId]));
  }

  async launchBelongsToExpert(
    tenantId: string,
    expertId: string,
    launchId: string,
  ): Promise<boolean> {
    const rows = await this.dataSource.query<unknown[]>(
      `
        SELECT 1 FROM "launches"
        WHERE "id" = $1 AND "tenantId" = $2 AND "expertId" = $3 AND "deletedAt" IS NULL
      `,
      [launchId, tenantId, expertId],
    );
    return rows.length > 0;
  }

  async resolveLaunch(input: {
    tenantId: string;
    expertId: string;
    pixelId: string;
    pageUrl: string;
    at: Date;
  }): Promise<string | null> {
    const [row] = await this.dataSource.query<{ launchId: string | null }[]>(
      `
        SELECT COALESCE(
          (
            SELECT p."launchId"
            FROM "tracking_pages" p
            JOIN "launches" l ON l."id" = p."launchId" AND l."deletedAt" IS NULL
            WHERE p."pixelId" = $3 AND p."pageUrl" = $4
          ),
          (
            SELECT l."id"
            FROM "launches" l
            WHERE l."tenantId" = $1 AND l."expertId" = $2 AND l."deletedAt" IS NULL
              AND l."startsAt" <= $5 AND (l."endsAt" IS NULL OR l."endsAt" >= $5)
            ORDER BY l."startsAt" DESC
            LIMIT 1
          )
        ) AS "launchId"
      `,
      [input.tenantId, input.expertId, input.pixelId, input.pageUrl, input.at],
    );
    return row?.launchId ?? null;
  }
}
