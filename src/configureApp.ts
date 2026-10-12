import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { Environment } from './config/Environment';

/** Configuração HTTP compartilhada entre o main.ts e os testes e2e. */
export function configureApp(app: NestExpressApplication): void {
  if (Environment.vars.TRUST_PROXY) {
    // Atrás de proxy/load balancer: faz o req.ip ser o IP real do cliente.
    app.set('trust proxy', 1);
  }

  app.use(cookieParser());

  if (Environment.vars.CORS_ORIGIN) {
    app.enableCors({
      origin: Environment.vars.CORS_ORIGIN.split(',').map((origin) =>
        origin.trim(),
      ),
      credentials: true,
    });
  }
}
