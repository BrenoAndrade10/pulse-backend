import { Controller, Get, Res } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Response } from 'express';
import { Public } from '../../../../shared/presentation/decorators/Public';

const PULSE_LOGO_PATH = join(
  __dirname,
  '../../application/services/templates/pulse-logo.png',
);

@Public()
@Controller('assets/brand')
export class PublicAssetsController {
  @Get('pulse-logo.png')
  getPulseLogo(@Res({ passthrough: true }) response: Response): Buffer {
    response.statusCode = 200;
    response.setHeader('Content-Type', 'image/png');
    response.setHeader('Cache-Control', 'public, max-age=86400');
    return readFileSync(PULSE_LOGO_PATH);
  }
}
