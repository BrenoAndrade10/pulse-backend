import { UserRole } from '../../../users/domain/enums/UserRole';
import { LeadHeatController } from './LeadHeatController';

describe('LeadHeatController', () => {
  const auth = {
    userId: 'user-id',
    sessionId: 'session-id',
    tenantId: 'tenant-id',
    role: UserRole.ADMIN,
  } as never;
  const expertId = '018f0f9f-6d25-7d9d-8cb8-3f2b1e9c4a6d';
  const leadId = '018f0f9f-6d25-7d9d-8cb8-3f2b1e9c4a6e';

  it('delegates validated ids and auth to the use case and returns its output as is', async () => {
    const output = {
      score: 22,
      band: 'warm',
      hasIdentity: true,
      timezone: 'America/Sao_Paulo',
      windowDays: 30,
      lastActivityDay: '2026-11-12',
      days: [],
    };
    const execute = jest.fn().mockResolvedValue(output);
    const controller = new LeadHeatController({ execute } as never);

    await expect(controller.get(expertId, leadId, auth)).resolves.toBe(output);
    expect(execute).toHaveBeenCalledWith({ expertId, leadId }, auth);
  });

  it.each([
    ['expertId', 'invalid', leadId],
    ['leadId', expertId, 'invalid'],
  ])('rejects an invalid %s before calling the use case', async (_, e, l) => {
    const execute = jest.fn();
    const controller = new LeadHeatController({ execute } as never);

    await expect(controller.get(e, l, auth)).rejects.toMatchObject({
      statusCode: 400,
      reason: 'VALIDATION_FAILED',
    });
    expect(execute).not.toHaveBeenCalled();
  });
});
