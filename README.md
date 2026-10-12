<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ yarn install
```

## Compile and run the project

```bash
# development
$ yarn run start

# watch mode
$ yarn run start:dev

# production mode
$ yarn run start:prod
```

## Meta Integration

The backend already exposes the base webhook used by Meta/Instagram:

- `GET /meta/webhooks`: verification endpoint used by Meta when configuring the webhook.
- `POST /meta/webhooks`: receives webhook events and validates `x-hub-signature-256` when `META_APP_SECRET` is configured.
- `GET /meta/reels`: lists Instagram Reels for the configured Instagram user. You can also pass `?instagramUserId=...&limit=25`.

Environment variables:

```bash
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
META_WEBHOOK_VERIFY_TOKEN=choose-a-private-verification-token
META_APP_SECRET=meta-app-secret
META_ACCESS_TOKEN=meta-page-or-system-user-access-token
META_INSTAGRAM_USER_ID=instagram-business-or-creator-account-id
META_GRAPH_API_VERSION=v21.0
META_TOKENS_ENCRYPTION_KEY=32-byte-base64-or-hex-key
```

`DATABASE_URL` must point to your Neon Postgres database. SSL is enabled in the TypeORM datasource for Neon.
`META_WEBHOOK_VERIFY_TOKEN` must match the verify token configured in the Meta app dashboard. `META_ACCESS_TOKEN` is used by `MetaGraphClient` and must include Instagram media permissions to list Reels and later comment/DM permissions for replies.
`META_INSTAGRAM_USER_ID` is the Instagram professional account ID used by `GET /meta/reels`.
`META_TOKENS_ENCRYPTION_KEY` is used to encrypt each expert's Meta/Instagram tokens before persistence. Generate a 32-byte base64 key with:

```bash
openssl rand -base64 32
```

Run database migrations:

```bash
npm run migration:run
```

## Authentication

Sessions use a short-lived JWT access token plus an opaque refresh token stored (hashed) in Redis. Every route requires `Authorization: Bearer <accessToken>` unless it is marked with `@Public()`.

- `POST /auth/login`: `{ email, password, tenantId? }` → `{ accessToken, expiresIn, user, activeTenant, tenants }`. The refresh token is set only as an `HttpOnly; Secure; SameSite=Strict; Path=/auth` cookie.
- `POST /auth/refresh`: uses the cookie, rotates the refresh token and returns a new access token. Reusing an already-rotated token (outside a short grace period) revokes the session.
- `POST /auth/logout`: revokes the current session and clears the cookie.
- `POST /auth/logout-all`: revokes every session of the authenticated user.
- `GET /auth/me`: returns the authenticated user, active tenant and memberships.

Environment variables:

```bash
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
JWT_SECRET=at-least-32-random-characters
JWT_ISSUER=backend
JWT_AUDIENCE=backend-app
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_IDLE_TTL_SECONDS=604800
SESSION_ABSOLUTE_TTL_SECONDS=2592000
REFRESH_TOKEN_GRACE_PERIOD_SECONDS=10
AUTH_COOKIE_SECURE=true
CORS_ORIGIN=http://localhost:5173
TRUST_PROXY=false
```

Generate `JWT_SECRET` with `openssl rand -base64 48`. Configure Redis with `maxmemory-policy noeviction` and AOF persistence so sessions are never silently evicted or lost on restart.

## Instagram business login

Each expert connects their Instagram professional account through the Instagram API with Instagram Login:

1. `POST /meta/instagram/authorizations` (authenticated) with `{ expertId }` returns `{ authorizationUrl }`. The frontend redirects the user there. A single-use `state` (10 min, stored in Redis) binds the flow to the tenant, user and expert.
2. Instagram redirects to `GET /meta/instagram/callback` — this is the **redirect URL to register in the Meta app dashboard**. The backend validates and consumes the `state`, exchanges the code for a long-lived token (~60 days), stores it encrypted (AES-256-GCM) in `expert_meta_credentials` and redirects to `FRONTEND_URL/experts/:id?instagram=connected` (or `?instagram=error&reason=invalid_state|denied|expert_not_found|exchange_failed`).

Environment variables:

```bash
INSTAGRAM_APP_ID=instagram-app-id          # "Instagram app ID" in the Meta app dashboard
INSTAGRAM_APP_SECRET=instagram-app-secret
INSTAGRAM_REDIRECT_URI=https://api.example.com/meta/instagram/callback
INSTAGRAM_SCOPES=instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages
INSTAGRAM_GRAPH_API_VERSION=v25.0
FRONTEND_URL=http://localhost:5173
META_TOKENS_ENCRYPTION_KEY=32-byte-base64-key   # openssl rand -base64 32
```

Meta requires HTTPS and an exact match of the redirect URI. For local development, expose the backend with a tunnel (e.g. `npx cloudflared tunnel --url http://localhost:3001`) and register `https://<tunnel-host>/meta/instagram/callback`.

## Run tests

```bash
# unit tests
$ yarn run test

# e2e tests
$ yarn run test:e2e

# test coverage
$ yarn run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ yarn install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
