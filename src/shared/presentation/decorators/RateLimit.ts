import { SetMetadata } from '@nestjs/common';

export type RateLimitSource = 'ip' | `body.${string}` | 'user';

export type RateLimitRule = {
  key: string;
  by: RateLimitSource[];
  limit: number;
  window: number;
  resetOnSuccess?: boolean;
};

export const RATE_LIMIT_RULES = Symbol('RATE_LIMIT_RULES');

export const RateLimit = (rules: RateLimitRule[]) =>
  SetMetadata(RATE_LIMIT_RULES, rules);
