import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { Public } from '../auth/auth.decorators.js';
import { type LiveCategory, LiveService } from './live.service.js';

export const LIVE_CATEGORIES = ['haramain', 'dua', 'quran', 'sohbet', 'other'] as const;

class StreamsQuery {
  @ApiPropertyOptional({ enum: ['live', 'upcoming'], description: 'Omit for both' })
  @IsOptional()
  @IsIn(['live', 'upcoming'])
  status?: 'live' | 'upcoming';

  @ApiPropertyOptional({ enum: LIVE_CATEGORIES })
  @IsOptional()
  @IsIn(LIVE_CATEGORIES)
  category?: LiveCategory;
}

@ApiTags('Live streams')
@Public()
@Controller({ path: 'live', version: '1' })
export class LiveController {
  constructor(private readonly live: LiveService) {}

  @Get('streams')
  @ApiOperation({
    summary: 'Live and upcoming streams from curated channels',
    description:
      'Play with the YouTube IFrame player (`embedUrl`). Refreshed every couple of minutes.',
  })
  streams(@Query() query: StreamsQuery) {
    return this.live.streams(query);
  }

  @Get('channels')
  channels() {
    return this.live.channels();
  }
}
