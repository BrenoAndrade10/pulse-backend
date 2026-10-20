import dotenv from 'dotenv';
import * as yup from 'yup';
import type { InferType } from 'yup';
import { parseAes256Key } from '../shared/infra/crypto/parseAes256Key';

export class Environment {
  private static varsSchema = yup.object({
    PORT: yup.number().optional().default(3000),

    DATABASE_URL: yup.string().optional(),
    NEON_DATABASE_URL: yup.string().optional(),
    POSTGRES_URL: yup.string().optional(),

    META_WEBHOOK_VERIFY_TOKEN: yup.string().optional(),
    META_APP_SECRET: yup.string().optional(),
    META_ACCESS_TOKEN: yup.string().optional(),
    META_INSTAGRAM_USER_ID: yup.string().optional(),
    META_GRAPH_API_VERSION: yup.string().optional().default('v21.0'),
    META_TOKENS_ENCRYPTION_KEY: yup
      .string()
      .optional()
      .test(
        'aes-256-key',
        'META_TOKENS_ENCRYPTION_KEY deve ter 32 bytes em base64 (44 caracteres) ou hex (64 caracteres). Gere com: openssl rand -base64 32',
        (value) => !value || parseAes256Key(value) !== null,
      ),

    INSTAGRAM_APP_ID: yup.string().optional(),
    INSTAGRAM_APP_SECRET: yup.string().optional(),
    INSTAGRAM_REDIRECT_URI: yup.string().optional(),
    INSTAGRAM_SCOPES: yup
      .string()
      .optional()
      .default(
        'instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages',
      ),
    INSTAGRAM_GRAPH_API_VERSION: yup.string().optional().default('v25.0'),

    FRONTEND_URL: yup.string().optional().default('http://localhost:5173'),

    TRACKING_SCRIPT_URL: yup
      .string()
      .optional()
      .default('https://cdn.pulse.app/p.js')
      .test(
        'http-url',
        'TRACKING_SCRIPT_URL deve ser uma URL http(s).',
        (value) => {
          try {
            return /^https?:$/.test(new URL(value ?? '').protocol);
          } catch {
            return false;
          }
        },
      ),
    // Só em desenvolvimento: aceita páginas em http://localhost para testar o editor.
    TRACKING_ALLOW_LOCAL_PAGES: yup.boolean().default(false),

    // Cifra os dados pessoais dos leads (32 bytes em base64 ou hex).
    LEADS_ENCRYPTION_KEY: yup
      .string()
      .optional()
      .test(
        'aes-256-key',
        'LEADS_ENCRYPTION_KEY deve ter 32 bytes em base64 (44 caracteres) ou hex (64 caracteres). Gere com: openssl rand -base64 32',
        (value) => !value || parseAes256Key(value) !== null,
      ),

    // ClickHouse Cloud (eventos do pixel). Sem eles, os eventos não são guardados.
    CLICKHOUSE_URL: yup.string().optional(),
    CLICKHOUSE_USERNAME: yup.string().optional(),
    CLICKHOUSE_PASSWORD: yup.string().optional(),
    CLICKHOUSE_DATABASE: yup.string().optional(),

    UPSTASH_REDIS_REST_URL: yup.string().required(),
    UPSTASH_REDIS_REST_TOKEN: yup.string().required(),

    JWT_SECRET: yup
      .string()
      .min(32, 'JWT_SECRET deve ter pelo menos 32 caracteres.')
      .required(),
    JWT_ISSUER: yup.string().optional().default('backend'),
    JWT_AUDIENCE: yup.string().optional().default('backend-app'),
    ACCESS_TOKEN_TTL_SECONDS: yup.number().integer().min(60).default(900),
    REFRESH_TOKEN_IDLE_TTL_SECONDS: yup
      .number()
      .integer()
      .min(300)
      .default(604800),
    SESSION_ABSOLUTE_TTL_SECONDS: yup
      .number()
      .integer()
      .min(300)
      .default(2592000),
    REFRESH_TOKEN_GRACE_PERIOD_SECONDS: yup
      .number()
      .integer()
      .min(0)
      .max(60)
      .default(10),
    AUTH_COOKIE_SECURE: yup.boolean().default(true),

    CORS_ORIGIN: yup.string().optional(),
    TRUST_PROXY: yup.boolean().default(false),
  });

  static vars: InferType<typeof Environment.varsSchema>;

  static assertInitialized(): void {
    if (Environment.isInitialized()) return;

    dotenv.config();

    Environment.vars = Environment.varsSchema.validateSync(process.env, {
      abortEarly: false,
      stripUnknown: true,
    });
  }

  private static isInitialized(): boolean {
    return Environment.vars !== undefined;
  }
}
