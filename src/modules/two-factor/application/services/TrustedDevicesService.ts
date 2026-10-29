import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR } from '../../../../shared/domain/IdGenerator';
import type { IdGenerator } from '../../../../shared/domain/IdGenerator';
import { TRUSTED_DEVICES_REPOSITORY } from '../../domain/repositories/TrustedDevicesRepository';
import type {
  TrustedDeviceRecord,
  TrustedDevicesRepository,
} from '../../domain/repositories/TrustedDevicesRepository';
import { TrustedDeviceTokens } from './TrustedDeviceTokens';

const TTL_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class TrustedDevicesService {
  constructor(
    @Inject(TRUSTED_DEVICES_REPOSITORY)
    private readonly devices: TrustedDevicesRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly tokens: TrustedDeviceTokens,
  ) {}

  async validate(userId: string, token: string | null): Promise<boolean> {
    if (!token) return false;
    return Boolean(
      await this.devices.validateAndTouch(
        this.tokens.hash(token),
        userId,
        new Date(),
      ),
    );
  }

  async create(
    userId: string,
    userAgent: string | null,
  ): Promise<{ token: string; expiresAt: Date }> {
    const now = new Date();
    const generated = this.tokens.generate();
    const expiresAt = new Date(now.getTime() + TTL_MS);
    await this.devices.create({
      id: this.ids.generate(),
      userId,
      tokenHash: generated.tokenHash,
      label: this.label(userAgent),
      expiresAt,
      lastUsedAt: now,
      createdAt: now,
    });
    return { token: generated.token, expiresAt };
  }

  list(userId: string): Promise<TrustedDeviceRecord[]> {
    return this.devices.listByUserId(userId);
  }

  revoke(userId: string, deviceId: string): Promise<boolean> {
    return this.devices.revoke(userId, deviceId);
  }

  revokeAll(userId: string): Promise<void> {
    return this.devices.deleteForUser(userId);
  }

  hash(token: string): string {
    return this.tokens.hash(token);
  }

  private label(userAgent: string | null): string {
    const ua = userAgent ?? '';
    const browser = /Edg\//.test(ua)
      ? 'Edge'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Navegador';
    const os = /Mac OS X/.test(ua)
      ? 'macOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Android/.test(ua)
          ? 'Android'
          : /iPhone|iPad/.test(ua)
            ? 'iOS'
            : 'dispositivo';
    return `${browser} no ${os}`.slice(0, 120);
  }
}
