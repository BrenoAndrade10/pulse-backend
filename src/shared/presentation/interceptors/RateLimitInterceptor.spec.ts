import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { lastValueFrom, of, throwError } from 'rxjs';
import { DomainError } from '../../errors/DomainError';
import type { RateLimiter } from '../../infra/redis/RateLimiter';
import type { RateLimitRule } from '../decorators/RateLimit';
import { RateLimitInterceptor } from './RateLimitInterceptor';

describe('RateLimitInterceptor', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const limiter = { consume: jest.fn(), reset: jest.fn() };
  const challenges = { get: jest.fn() };
  const setHeader = jest.fn();
  let request: Partial<Request> & { auth?: { userId: string } };
  let context: ExecutionContext;
  let next: CallHandler;
  let handle: jest.Mock;
  let interceptor: RateLimitInterceptor;

  beforeEach(() => {
    jest.clearAllMocks();
    request = {
      ip: '192.0.2.10',
      body: { email: ' User@Example.com ' },
    };
    context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({ setHeader }) as unknown as Response,
        getNext: jest.fn(),
      }),
    } as unknown as ExecutionContext;
    handle = jest.fn().mockReturnValue(of({ ok: true }));
    next = { handle };
    limiter.consume.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 900,
    });
    limiter.reset.mockResolvedValue(undefined);
    interceptor = new RateLimitInterceptor(
      reflector as unknown as Reflector,
      limiter as unknown as RateLimiter,
      challenges as never,
    );
  });

  it('normalizes and hashes email keys and resets successful rules', async () => {
    const rules: RateLimitRule[] = [
      {
        key: 'auth:login:pair',
        by: ['ip', 'body.email'],
        limit: 5,
        window: 900,
        resetOnSuccess: true,
      },
      { key: 'auth:login:ip', by: ['ip'], limit: 20, window: 900 },
      {
        key: 'auth:login:email',
        by: ['body.email'],
        limit: 50,
        window: 3600,
        resetOnSuccess: true,
      },
    ];
    reflector.getAllAndOverride.mockReturnValue(rules);
    const emailHash = createHash('sha256')
      .update('user@example.com')
      .digest('hex');

    await expect(
      lastValueFrom(await interceptor.intercept(context, next)),
    ).resolves.toEqual({ ok: true });

    expect(limiter.consume).toHaveBeenNthCalledWith(
      1,
      `auth:login:pair:192.0.2.10:${emailHash}`,
      5,
      900,
    );
    expect(limiter.consume).toHaveBeenNthCalledWith(
      3,
      `auth:login:email:${emailHash}`,
      50,
      3600,
    );
    expect(limiter.reset).toHaveBeenCalledWith(
      `auth:login:pair:192.0.2.10:${emailHash}`,
    );
    expect(limiter.reset).toHaveBeenCalledWith(`auth:login:email:${emailHash}`);
  });

  it('returns the greatest wait without calling the handler', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      { key: 'one', by: ['ip'], limit: 1, window: 60 },
      { key: 'two', by: ['ip'], limit: 1, window: 60 },
    ] satisfies RateLimitRule[]);
    limiter.consume
      .mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 12 })
      .mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 42 });

    await expect(interceptor.intercept(context, next)).rejects.toMatchObject({
      statusCode: 429,
      reason: 'TOO_MANY_ATTEMPTS',
      data: { retryAfterSeconds: 42 },
    });
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '42');
    expect(handle).not.toHaveBeenCalled();
  });

  it('does not reset a failed response', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      {
        key: 'auth:test',
        by: ['ip'],
        limit: 1,
        window: 60,
        resetOnSuccess: true,
      },
    ] satisfies RateLimitRule[]);
    const error = new DomainError(400, 'FAILED');
    handle.mockReturnValue(throwError(() => error));

    await expect(
      lastValueFrom(await interceptor.intercept(context, next)),
    ).rejects.toBe(error);
    expect(limiter.reset).not.toHaveBeenCalled();
  });

  it('resolves a public challenge user', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      { key: 'auth:2fa:verify', by: ['user'], limit: 5, window: 900 },
    ] satisfies RateLimitRule[]);
    request.body = { challengeToken: 'challenge-token' };
    challenges.get.mockResolvedValue({ userId: 'user-id' });

    await lastValueFrom(await interceptor.intercept(context, next));

    expect(challenges.get).toHaveBeenCalledWith('challenge-token');
    expect(limiter.consume).toHaveBeenCalledWith(
      'auth:2fa:verify:user-id',
      5,
      900,
    );
  });

  it('propagates Redis unavailability as 503', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      { key: 'auth:test', by: ['ip'], limit: 1, window: 60 },
    ] satisfies RateLimitRule[]);
    const error = new DomainError(503, 'SERVICE_UNAVAILABLE');
    limiter.consume.mockRejectedValue(error);

    await expect(interceptor.intercept(context, next)).rejects.toBe(error);
  });
});
