import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsInt, IsNumber, IsObject, IsOptional, Matches, Max, Min } from 'class-validator';
import { type AuthUser, CurrentUser, Public, Roles } from '../auth/auth.decorators.js';
import { SettingsService } from '../settings/settings.service.js';
import { duaCategorySchema, duaSchema, esmaSchema, religiousDaySchema } from './content.schemas.js';
import { parseOrThrow } from '../common/zod.js';
import { ContentService } from './content.service.js';
import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CACHE_HOUR = 'public, max-age=3600, stale-while-revalidate=86400';

class DaysQuery {
  @ApiPropertyOptional({ example: '2027-01-01' }) @IsOptional() @Matches(ISO_DATE) from?: string;
  @ApiPropertyOptional({ example: '2027-12-31' }) @IsOptional() @Matches(ISO_DATE) to?: string;
}

class SettingsPutDto {
  @ApiProperty({ description: 'The version you last read (0 if none yet)' })
  @IsInt()
  @Min(0)
  version: number;

  @ApiProperty({ description: 'The full settings document; validated server-side' })
  @IsObject()
  data: Record<string, unknown>;
}

class ZakatRatesDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10_000_000) goldGramPrice?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10_000_000)
  silverGramPrice?: number;
  @ApiPropertyOptional({ default: 80.18 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10_000)
  goldNisabGrams?: number;
  @ApiPropertyOptional({ default: 561 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100_000)
  silverNisabGrams?: number;
}

/** Public, cacheable editorial content (ETag handled by Express). */
@ApiTags('Content')
@Public()
@Controller({ path: 'content', version: '1' })
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get('duas')
  @Header('Cache-Control', CACHE_HOUR)
  @ApiOperation({ summary: 'Dua categories with counts and all published duas' })
  duas() {
    return this.content.duas();
  }

  @Get('esma')
  @Header('Cache-Control', CACHE_HOUR)
  esma() {
    return this.content.esma();
  }

  @Get('religious-days')
  @Header('Cache-Control', CACHE_HOUR)
  @ApiOperation({ summary: 'Holy days (Diyanet list); defaults to the coming year' })
  religiousDays(@Query() query: DaysQuery) {
    return this.content.religiousDays(query.from, query.to);
  }

  @Get('zakat-rates')
  @Header('Cache-Control', 'public, max-age=600')
  @ApiOperation({ summary: 'Gold/silver gram prices and nisab for the zakat calculator' })
  zakat() {
    return this.content.zakatRates();
  }
}

@ApiTags('Me')
@ApiBearerAuth()
@Controller({ path: 'me/settings', version: '1' })
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'App settings document (theme, language, notifications, favourites…)' })
  get(@CurrentUser() user: AuthUser) {
    return this.settings.get(user.id);
  }

  @Put()
  @ApiOperation({
    summary: 'Replace the settings document',
    description:
      'Send the version you read. On 409 the response details contain the current document; merge and retry.',
  })
  put(@CurrentUser() user: AuthUser, @Body() body: SettingsPutDto) {
    return this.settings.put(user.id, body.version, body.data);
  }
}

const listOf = <T extends z.ZodType>(schema: T) => z.array(schema).min(1).max(500);

@ApiTags('Admin')
@Controller({ path: 'admin/content', version: '1' })
export class ContentAdminController {
  constructor(private readonly content: ContentService) {}

  @Roles('admin')
  @Put('dua-categories')
  @ApiBody({ description: 'Array of categories, upserted by id' })
  async categories(@Body() body: unknown) {
    return {
      upserted: await this.content.upsertCategories(parseOrThrow(listOf(duaCategorySchema), body)),
    };
  }

  @Roles('admin')
  @Put('duas')
  @ApiBody({ description: 'Array of duas, upserted by key' })
  async duas(@Body() body: unknown) {
    return { upserted: await this.content.upsertDuas(parseOrThrow(listOf(duaSchema), body)) };
  }

  @Roles('admin')
  @Delete('duas/:key')
  @HttpCode(204)
  async deleteDua(@Param('key') key: string): Promise<void> {
    await this.content.deleteDua(key);
  }

  @Roles('admin')
  @Put('esma')
  @ApiBody({ description: 'Array of names, upserted by number' })
  async esma(@Body() body: unknown) {
    return { upserted: await this.content.upsertEsma(parseOrThrow(listOf(esmaSchema), body)) };
  }

  @Roles('admin')
  @Post('religious-days')
  @ApiOperation({ summary: 'Import holy days from Diyanet’s list (upsert by date + key)' })
  @ApiBody({ description: 'Array of { date, key, nameTr, nameEn?, hijri?, note? }' })
  async importDays(@Body() body: unknown) {
    return {
      upserted: await this.content.upsertReligiousDays(
        parseOrThrow(listOf(religiousDaySchema), body),
      ),
    };
  }

  @Roles('admin')
  @Delete('religious-days/:id')
  @HttpCode(204)
  async deleteDay(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.content.deleteReligiousDay(id);
  }

  @Roles('admin')
  @Put('zakat-rates')
  zakat(@CurrentUser() user: AuthUser, @Body() body: ZakatRatesDto) {
    return this.content.setZakatRates(user.id, body);
  }
}
