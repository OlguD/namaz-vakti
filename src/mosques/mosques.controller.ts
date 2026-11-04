import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { type AuthUser, CurrentUser, Public, RegisteredOnly } from '../auth/auth.decorators.js';
import { MosquesService } from './mosques.service.js';

class NearbyMosquesQuery {
  @ApiProperty({ example: 41.0082 })
  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  lat: number;

  @ApiProperty({ example: 28.9784 })
  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  lng: number;

  @ApiPropertyOptional({ description: 'Metres', minimum: 100, maximum: 10000, default: 3000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(10_000)
  radius = 3_000;

  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 50;
}

class SuggestionDto {
  @ApiProperty({ enum: ['add', 'edit', 'closed'] })
  @IsIn(['add', 'edit', 'closed'])
  kind: 'add' | 'edit' | 'closed';

  @ApiPropertyOptional({ description: 'Required for edit and closed' })
  @IsOptional()
  @IsUUID()
  mosqueId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(250)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

@ApiTags('Mosques')
@Controller({ path: 'mosques', version: '1' })
export class MosquesController {
  constructor(private readonly mosques: MosquesService) {}

  @Public()
  @Get('nearby')
  @ApiOperation({
    summary: 'Mosques around a position, nearest first',
    description:
      'Data © OpenStreetMap contributors — show `attribution` on the map. The first request for a new area imports it; if `partial` is true, ask again after a few seconds.',
  })
  nearby(@Query() query: NearbyMosquesQuery) {
    return this.mosques.nearby(query.lat, query.lng, query.radius, query.limit);
  }

  @Public()
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.mosques.get(id);
  }

  @RegisteredOnly()
  @Post('suggestions')
  @ApiOperation({ summary: 'Suggest a new mosque, a correction, or that one has closed' })
  suggest(@CurrentUser() user: AuthUser, @Body() body: SuggestionDto) {
    const { kind, mosqueId, ...payload } = body;
    return this.mosques.suggest(user.id, kind, mosqueId, payload);
  }
}
