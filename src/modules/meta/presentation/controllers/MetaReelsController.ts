import { Controller, Get, Query } from '@nestjs/common';
import { ListInstagramReelsUseCase } from '../../application/use-cases/ListInstagramReelsUseCase';

@Controller('meta/reels')
export class MetaReelsController {
  constructor(
    private readonly listInstagramReelsUseCase: ListInstagramReelsUseCase,
  ) {}

  @Get()
  listReels(
    @Query('instagramUserId') instagramUserId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.listInstagramReelsUseCase.execute({
      instagramUserId,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
