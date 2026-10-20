import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { Request } from 'express';
import { Environment } from './config/Environment';

/** Configuração HTTP compartilhada entre o main.ts e os testes e2e. */
export function configureApp(app: NestExpressApplication): void {
  if (Environment.vars.TRUST_PROXY) {
    // Atrás de proxy/load balancer: faz o req.ip ser o IP real do cliente.
    app.set('trust proxy', 1);
  }

  app.use(cookieParser());
  // Lotes do pixel: o sendBeacon envia text/plain (sem checagem de CORS).
  app.useBodyParser('text', { type: 'text/plain', limit: '64kb' });

  const appOrigins = Environment.vars.CORS_ORIGIN?.split(',').map((origin) =>
    origin.trim(),
  );

  app.enableCors((request: Request, callback) => {
    // Rotas do pixel: chamadas pelas páginas dos clientes, de qualquer origem,
    // e nunca com cookies. Quem autoriza é o token (ver TrackerSetupController).
    if (request.url?.startsWith('/t/')) {
      callback(null, {
        origin: true,
        credentials: false,
        methods: ['GET', 'POST', 'DELETE'],
        allowedHeaders: ['Content-Type', 'X-Pulse-Setup-Token'],
        maxAge: 600,
      });
      return;
    }

    callback(
      null,
      appOrigins
        ? { origin: appOrigins, credentials: true }
        : { origin: false },
    );
  });
}
