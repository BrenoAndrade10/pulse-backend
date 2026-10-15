import dotenv from 'dotenv';
import * as yup from 'yup';
import type { InferType } from 'yup';

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
    META_TOKENS_ENCRYPTION_KEY: yup.string().optional(),

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
