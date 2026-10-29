import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { mergeMap, type Observable } from 'rxjs';
import { AuthChallengeStore } from '../../../modules/two-factor/infra/redis/AuthChallengeStore';
import type { AccessTokenClaims } from '../../../modules/auth/domain/types/AccessTokenClaims';
import { DomainError } from '../../errors/DomainError';
import { RateLimiter } from '../../infra/redis/RateLimiter';
import {
  RATE_LIMIT_RULES,
  type RateLimitRule,
  type RateLimitSource,
} from '../decorators/RateLimit';

type RateLimitRequest = Request & { auth?: AccessTokenClaims };

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimiter: RateLimiter,
    private readonly challenges: AuthChallengeStore,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const rules = this.reflector.getAllAndOverride<RateLimitRule[]>(
      RATE_LIMIT_RULES,
      [context.getHandler(), context.getClass()],
    );
    if (!rules?.length) return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<RateLimitRequest>();
    const response = http.getResponse<Response>();
    const userId = await this.resolveUserId(request, rules);
    const keyedRules = rules.map((rule) => ({
      rule,
      key: this.key(rule, request, userId),
    }));
    const results = await Promise.all(
      keyedRules.map(({ rule, key }) =>
        this.rateLimiter.consume(key, rule.limit, rule.window),
      ),
    );
    if (results.some((result) => !result.allowed)) {
      const retryAfterSeconds = Math.max(
        ...results.map((result) => result.retryAfterSeconds),
      );
      response.setHeader('Retry-After', String(Math.ceil(retryAfterSeconds)));
      throw new DomainError(429, 'TOO_MANY_ATTEMPTS', {
        retryAfterSeconds,
      });
    }

    const resetKeys = keyedRules
      .filter(({ rule }) => rule.resetOnSuccess)
      .map(({ key }) => key);
    if (!resetKeys.length) return next.handle();
    return next.handle().pipe(
      mergeMap(async (value: unknown): Promise<unknown> => {
        await Promise.all(resetKeys.map((key) => this.rateLimiter.reset(key)));
        return value;
      }),
    );
  }

  private async resolveUserId(
    request: RateLimitRequest,
    rules: RateLimitRule[],
  ): Promise<string | null> {
    if (!rules.some((rule) => rule.by.includes('user'))) return null;
    if (request.auth?.userId) return request.auth.userId;
    const token = this.bodyValue(request.body, 'challengeToken');
    if (typeof token !== 'string') {
      throw new DomainError(401, 'AUTH_CHALLENGE_INVALID');
    }
    return (await this.challenges.get(token)).userId;
  }

  private key(
    rule: RateLimitRule,
    request: RateLimitRequest,
    userId: string | null,
  ): string {
    const values = rule.by.map((source) =>
      this.sourceValue(source, request, userId),
    );
    return [rule.key, ...values].join(':');
  }

  private sourceValue(
    source: RateLimitSource,
    request: RateLimitRequest,
    userId: string | null,
  ): string {
    if (source === 'ip') return request.ip ?? 'unknown';
    if (source === 'user') return userId ?? 'unknown';
    const path = source.slice('body.'.length);
    const value = this.bodyValue(request.body, path);
    const normalized =
      typeof value === 'string' ? value.trim().toLowerCase() : String(value);
    return path.toLowerCase().includes('email')
      ? createHash('sha256').update(normalized).digest('hex')
      : normalized;
  }

  private bodyValue(body: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>((value, field) => {
      if (!value || typeof value !== 'object') return undefined;
      return (value as Record<string, unknown>)[field];
    }, body);
  }
}
