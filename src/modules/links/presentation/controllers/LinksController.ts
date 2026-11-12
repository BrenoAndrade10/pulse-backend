import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { AccessTokenClaims } from '../../../auth/domain/types/AccessTokenClaims';
import { CurrentAuth } from '../../../auth/presentation/decorators/CurrentAuth';
import { CreateLinkUseCase } from '../../application/use-cases/CreateLinkUseCase';
import { ListLinksUseCase } from '../../application/use-cases/ListLinksUseCase';
import { UpdateLinkUseCase } from '../../application/use-cases/UpdateLinkUseCase';
import { YupValidationPipe } from '../../../../shared/presentation/pipes/YupValidationPipe';
import {
  createLinkSchema,
  listLinksQuerySchema,
  linkIdSchema,
  updateLinkSchema,
  type CreateLinkInput,
  type ListLinksQuery,
  type UpdateLinkInput,
} from '../schemas/LinkSchemas';
import { LinkResponseMapper } from '../LinkResponse';

@Controller('links')
export class LinksController {
  constructor(
    private readonly createLink: CreateLinkUseCase,
    private readonly listLinks: ListLinksUseCase,
    private readonly updateLink: UpdateLinkUseCase,
  ) {}

  @Post()
  create(
    @Body(new YupValidationPipe(createLinkSchema)) input: CreateLinkInput,
    @CurrentAuth() auth: AccessTokenClaims,
  ) {
    return this.createLink
      .execute(input, auth)
      .then((output) => LinkResponseMapper.from(output));
  }

  @Get()
  async list(
    @Query(new YupValidationPipe(listLinksQuerySchema)) query: ListLinksQuery,
    @CurrentAuth() auth: AccessTokenClaims,
  ) {
    const result = await this.listLinks.execute(query, auth);
    return {
      data: result.items.map(({ link, shortUrl }) =>
        LinkResponseMapper.fromLink(link, shortUrl),
      ),
      nextCursor: result.nextCursor,
    };
  }

  @Patch(':id')
  async update(
    @Param('id', new YupValidationPipe(linkIdSchema)) id: string,
    @Body(new YupValidationPipe(updateLinkSchema)) input: UpdateLinkInput,
    @CurrentAuth() auth: AccessTokenClaims,
  ) {
    const output = await this.updateLink.execute(id, input, auth);
    return LinkResponseMapper.from(output);
  }
}
