import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import type { ConnectWhatsAppUseCase } from '../../application/use-cases/ConnectWhatsAppUseCase';
import type { DisconnectWhatsAppUseCase } from '../../application/use-cases/DisconnectWhatsAppUseCase';
import type { GetWhatsAppConnectionUseCase } from '../../application/use-cases/GetWhatsAppConnectionUseCase';
import { WhatsAppConnectionController } from './WhatsAppConnectionController';

describe('WhatsAppConnectionController', () => {
  const auth = { tenantId: 'tenant-id' } as AccessTokenClaims;
  const connected = {
    status: 'connected' as const,
    phoneNumberId: '456',
    displayPhoneNumber: '+55 11 99999-9999',
    verifiedName: 'Pulse',
    qualityRating: 'GREEN',
    connectedAt: new Date('2026-10-20T12:00:00Z'),
  };
  let connect: jest.Mocked<Pick<ConnectWhatsAppUseCase, 'execute'>>;
  let get: jest.Mocked<Pick<GetWhatsAppConnectionUseCase, 'execute'>>;
  let disconnect: jest.Mocked<Pick<DisconnectWhatsAppUseCase, 'execute'>>;
  let controller: WhatsAppConnectionController;

  beforeEach(() => {
    connect = { execute: jest.fn().mockResolvedValue(connected) };
    get = { execute: jest.fn().mockResolvedValue({ status: 'disconnected' }) };
    disconnect = { execute: jest.fn().mockResolvedValue(undefined) };
    controller = new WhatsAppConnectionController(
      connect as unknown as ConnectWhatsAppUseCase,
      get as unknown as GetWhatsAppConnectionUseCase,
      disconnect as unknown as DisconnectWhatsAppUseCase,
    );
  });

  it('validates and forwards a connection request', async () => {
    await expect(
      controller.connect(
        'expert-id',
        { code: 'code', wabaId: '123', phoneNumberId: '456' },
        auth,
      ),
    ).resolves.toEqual(connected);
    expect(connect.execute).toHaveBeenCalledWith({
      tenantId: 'tenant-id',
      expertId: 'expert-id',
      code: 'code',
      wabaId: '123',
      phoneNumberId: '456',
    });
  });

  it('rejects unknown fields and non-numeric ids', async () => {
    await expect(
      controller.connect(
        'expert-id',
        {
          code: 'code',
          wabaId: 'invalid',
          phoneNumberId: '456',
          extra: true,
        },
        auth,
      ),
    ).rejects.toMatchObject({ reason: 'VALIDATION_FAILED' });
    expect(connect.execute).not.toHaveBeenCalled();
  });

  it('delegates status and disconnection', async () => {
    await expect(controller.get('expert-id', auth)).resolves.toEqual({
      status: 'disconnected',
    });
    await expect(controller.disconnect('expert-id', auth)).resolves.toBe(
      undefined,
    );
    expect(get.execute).toHaveBeenCalledWith('tenant-id', 'expert-id');
    expect(disconnect.execute).toHaveBeenCalledWith('tenant-id', 'expert-id');
  });
});
