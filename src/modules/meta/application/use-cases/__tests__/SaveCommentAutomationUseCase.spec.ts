/* eslint-disable @typescript-eslint/unbound-method */
import { DomainError } from '../../../../../shared/errors/DomainError';
import { Expert } from '../../../../experts/domain/entities/Expert';
import { ExpertStatus } from '../../../../experts/domain/enums/ExpertStatus';
import type { ExpertsRepository } from '../../../../experts/domain/repositories/ExpertsRepository';
import { CommentAutomation } from '../../../domain/entities/CommentAutomation';
import type { CommentAutomationsRepository } from '../../../domain/repositories/CommentAutomationsRepository';
import type { InstagramGraphClient } from '../../../infra/http/InstagramGraphClient';
import type { InstagramAccessTokens } from '../../services/InstagramAccessTokens';
import { SaveCommentAutomationUseCase } from '../SaveCommentAutomationUseCase';

describe('SaveCommentAutomationUseCase', () => {
  const input = {
    tenantId: 'tenant-a',
    expertId: 'expert-a',
    mediaId: '1790',
    keywords: ['Quero', 'quero ', 'LINK'],
    message: '  Aqui está o link!  ',
    isActive: true,
  };
  let experts: jest.Mocked<ExpertsRepository>;
  let automations: jest.Mocked<CommentAutomationsRepository>;
  let tokens: jest.Mocked<Pick<InstagramAccessTokens, 'forExpert'>>;
  let graph: jest.Mocked<Pick<InstagramGraphClient, 'subscribeToComments'>>;
  let useCase: SaveCommentAutomationUseCase;

  beforeEach(() => {
    experts = {
      create: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      findByTenantIdAndId: jest.fn().mockResolvedValue(makeExpert()),
      findByTenantIdAndEmail: jest.fn(),
      findByTenantId: jest.fn(),
      deleteByTenantIdAndId: jest.fn(),
    };
    automations = {
      upsert: jest.fn((automation: CommentAutomation) =>
        Promise.resolve(automation),
      ),
      findByExpert: jest.fn(),
      findByMedia: jest.fn().mockResolvedValue(null),
      delete: jest.fn(),
    };
    tokens = { forExpert: jest.fn().mockResolvedValue('plain-token') };
    graph = { subscribeToComments: jest.fn().mockResolvedValue(undefined) };
    useCase = new SaveCommentAutomationUseCase(
      experts,
      automations,
      tokens as unknown as InstagramAccessTokens,
      graph as unknown as InstagramGraphClient,
      { generate: () => 'new-id' },
    );
  });

  it('subscribes the account to comment webhooks and saves an active rule', async () => {
    const saved = await useCase.execute(input);

    expect(tokens.forExpert).toHaveBeenCalledWith('tenant-a', 'expert-a');
    expect(graph.subscribeToComments).toHaveBeenCalledWith('plain-token');
    expect(saved).toMatchObject({
      id: 'new-id',
      mediaId: '1790',
      keywords: ['Quero', 'LINK'],
      message: 'Aqui está o link!',
      isActive: true,
    });
  });

  it('does not save the rule when the account cannot be subscribed', async () => {
    tokens.forExpert.mockRejectedValue(
      new DomainError(409, 'INSTAGRAM_NOT_CONNECTED'),
    );

    await expect(useCase.execute(input)).rejects.toMatchObject({
      reason: 'INSTAGRAM_NOT_CONNECTED',
    });
    expect(automations.upsert).not.toHaveBeenCalled();
  });

  it('saves a paused rule without calling Meta', async () => {
    await useCase.execute({ ...input, isActive: false });

    expect(graph.subscribeToComments).not.toHaveBeenCalled();
    expect(automations.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: false }),
    );
  });

  it('keeps the id and creation date when updating', async () => {
    const createdAt = new Date('2026-10-01T00:00:00.000Z');
    automations.findByMedia.mockResolvedValue(
      new CommentAutomation({
        id: 'existing-id',
        tenantId: 'tenant-a',
        expertId: 'expert-a',
        mediaId: '1790',
        keywords: ['antiga'],
        message: 'Antiga',
        isActive: false,
        createdAt,
        updatedAt: createdAt,
      }),
    );

    const saved = await useCase.execute(input);

    expect(saved).toMatchObject({ id: 'existing-id', createdAt });
    expect(saved.updatedAt.getTime()).toBeGreaterThan(createdAt.getTime());
  });

  it('rejects rules whose keywords are all blank', async () => {
    await expect(
      useCase.execute({ ...input, keywords: ['  ', ''] }),
    ).rejects.toMatchObject({ reason: 'VALIDATION_FAILED' });
    expect(automations.upsert).not.toHaveBeenCalled();
  });

  it('hides experts from another tenant', async () => {
    experts.findByTenantIdAndId.mockResolvedValue(null);

    await expect(useCase.execute(input)).rejects.toMatchObject({
      statusCode: 404,
      reason: 'EXPERT_NOT_FOUND',
    });
    expect(graph.subscribeToComments).not.toHaveBeenCalled();
  });

  it('requires a tenant', async () => {
    await expect(
      useCase.execute({ ...input, tenantId: null }),
    ).rejects.toMatchObject({ statusCode: 403, reason: 'TENANT_REQUIRED' });
  });

  it('saves the button and the public reply, trimmed', async () => {
    const saved = await useCase.execute({
      ...input,
      button: { label: ' Ver material ', url: ' https://site.com/x ' },
      commentReply: '  Te mandei no direct!  ',
    });

    expect(saved.button).toEqual({
      label: 'Ver material',
      url: 'https://site.com/x',
    });
    expect(saved.commentReply).toBe('Te mandei no direct!');
  });

  it('clears the button and the public reply when they are removed', async () => {
    const saved = await useCase.execute({
      ...input,
      button: null,
      commentReply: '',
    });

    expect(saved.button).toBeUndefined();
    expect(saved.commentReply).toBeUndefined();
  });
});

function makeExpert(): Expert {
  const now = new Date();
  return new Expert({
    id: 'expert-a',
    tenantId: 'tenant-a',
    name: 'Expert',
    email: 'expert@test.com',
    status: ExpertStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
  });
}
