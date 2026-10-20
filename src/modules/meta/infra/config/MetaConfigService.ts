import { Injectable } from '@nestjs/common';
import { Environment } from '../../../../config/Environment';

@Injectable()
export class MetaConfigService {
  get graphApiBaseUrl(): string {
    Environment.assertInitialized();

    const version = Environment.vars.META_GRAPH_API_VERSION;

    return `https://graph.facebook.com/${version}`;
  }

  get accessToken(): string | undefined {
    Environment.assertInitialized();

    return Environment.vars.META_ACCESS_TOKEN;
  }

  get instagramUserId(): string | undefined {
    Environment.assertInitialized();

    return Environment.vars.META_INSTAGRAM_USER_ID;
  }

  get appSecret(): string | undefined {
    Environment.assertInitialized();

    return Environment.vars.META_APP_SECRET;
  }

  get instagramAppSecret(): string | undefined {
    Environment.assertInitialized();

    return Environment.vars.INSTAGRAM_APP_SECRET;
  }

  get webhookVerifyToken(): string | undefined {
    Environment.assertInitialized();

    return Environment.vars.META_WEBHOOK_VERIFY_TOKEN;
  }
}
