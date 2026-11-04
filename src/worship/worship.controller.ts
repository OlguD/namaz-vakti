import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { type AuthUser, CurrentUser } from '../auth/auth.decorators.js';
import { AppError } from '../common/errors.js';
import { QADA_KEYS, type QadaKey } from './qada.js';
import { type PrayerStatus, type Vakit, VAKITS, WorshipService } from './worship.service.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

class DateQuery {
  @ApiProperty({ description: 'The user’s local calendar day', example: '2026-11-04' })
  @Matches(ISO_DATE)
  date: string;
}

class RangeQuery {
  @ApiProperty({ example: '2026-10-29' })
  @Matches(ISO_DATE)
  from: string;

  @ApiProperty({ example: '2026-11-04' })
  @Matches(ISO_DATE)
  to: string;
}

class PrayerDto {
  @ApiProperty({
    enum: ['prayed', 'jamaah', 'qada'],
    nullable: true,
    description: 'null clears the mark',
  })
  @ValidateIf((_, value) => value !== null)
  @IsIn(['prayed', 'jamaah', 'qada'])
  status: PrayerStatus | null;
}

class QadaDto {
  @ApiProperty() @IsInt() @Min(0) @Max(1_000_000) sabah: number;
  @ApiProperty() @IsInt() @Min(0) @Max(1_000_000) ogle: number;
  @ApiProperty() @IsInt() @Min(0) @Max(1_000_000) ikindi: number;
  @ApiProperty() @IsInt() @Min(0) @Max(1_000_000) aksam: number;
  @ApiProperty() @IsInt() @Min(0) @Max(1_000_000) yatsi: number;
  @ApiProperty() @IsInt() @Min(0) @Max(1_000_000) vitir: number;
}

class QadaAdjustDto {
  @ApiProperty({ enum: [-1, 1], description: '-1 after performing one make-up prayer' })
  @IsIn([-1, 1])
  delta: -1 | 1;
}

class QadaEstimateDto {
  @ApiProperty({ example: 1992 }) @IsInt() @Min(1900) @Max(2100) birthYear: number;
  @ApiProperty({ example: 15 }) @IsInt() @Min(9) @Max(18) pubertyAge: number;
  @ApiProperty({ example: 2016 }) @IsInt() @Min(1900) @Max(2100) regularSince: number;
  @ApiProperty({ example: 25 }) @IsInt() @Min(0) @Max(100) prayedPercent: number;

  @ApiPropertyOptional({ description: 'Also store the result as the qada counters' })
  @IsOptional()
  @IsBoolean()
  apply?: boolean;
}

class DhikrDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) arabic?: string;
  @ApiProperty() @IsString() @Length(1, 120) transliteration: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) meaning?: string;
  @ApiProperty({ example: 100 }) @IsInt() @Min(1) @Max(100_000) target: number;
}

class DhikrPatchDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(300)
  arabic?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 120) transliteration?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(300)
  meaning?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(100_000) target?: number;
}

class DhikrEntryDto {
  @ApiProperty({ example: '2026-11-04' }) @Matches(ISO_DATE) date: string;
  @ApiProperty({ example: 'subhanallah' }) @IsString() @MaxLength(60) dhikrKey: string;
  @ApiProperty({ description: 'Taps counted since the last sync', example: 33 })
  @IsInt()
  @Min(1)
  @Max(100_000)
  count: number;
}

class DhikrSyncDto {
  @ApiProperty({ description: 'Client-generated id (e.g. UUID) for this upload; retries reuse it' })
  @Matches(/^[\w-]{8,64}$/)
  batchId: string;

  @ApiProperty({ type: [DhikrEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DhikrEntryDto)
  @ArrayMaxSize(200)
  entries: DhikrEntryDto[];
}

class StatsQuery {
  @ApiPropertyOptional({ enum: ['week', 'month'], default: 'week' })
  @IsOptional()
  @IsIn(['week', 'month'])
  range: 'week' | 'month' = 'week';

  @ApiProperty({ description: 'The user’s local calendar day', example: '2026-11-04' })
  @Matches(ISO_DATE)
  today: string;
}

/**
 * Personal worship records, synced across the user's devices and the web app.
 * Works for anonymous accounts too; signing in later keeps the data.
 */
@ApiTags('Worship')
@ApiBearerAuth()
@Controller({ path: 'worship', version: '1' })
export class WorshipController {
  constructor(private readonly worship: WorshipService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'İbadet home card: today’s prayers, dhikr total, khatm progress, streak',
  })
  summary(@CurrentUser() user: AuthUser, @Query() query: DateQuery) {
    return this.worship.summary(user.id, query.date);
  }

  @Get('prayers')
  @ApiOperation({ summary: 'Prayer log for a date range (max 62 days)' })
  prayers(@CurrentUser() user: AuthUser, @Query() query: RangeQuery) {
    return this.worship.prayers(user.id, query.from, query.to);
  }

  @Put('prayers/:date/:vakit')
  @HttpCode(204)
  async setPrayer(
    @CurrentUser() user: AuthUser,
    @Param('date') date: string,
    @Param('vakit') vakit: string,
    @Body() body: PrayerDto,
  ): Promise<void> {
    if (!VAKITS.includes(vakit as Vakit)) {
      throw AppError.notFound('Vakit');
    }
    await this.worship.setPrayer(user.id, date, vakit as Vakit, body.status);
  }

  @Get('qada')
  qada(@CurrentUser() user: AuthUser) {
    return this.worship.qada(user.id);
  }

  @Put('qada')
  @ApiOperation({ summary: 'Set all qada counters (e.g. from the calculator)' })
  setQada(@CurrentUser() user: AuthUser, @Body() body: QadaDto) {
    return this.worship.setQada(user.id, body);
  }

  @Post('qada/:vakit/adjust')
  @HttpCode(200)
  @ApiOperation({ summary: 'Atomically add or remove one from a counter (never below zero)' })
  adjustQada(
    @CurrentUser() user: AuthUser,
    @Param('vakit') vakit: string,
    @Body() body: QadaAdjustDto,
  ) {
    if (!QADA_KEYS.includes(vakit as QadaKey)) {
      throw AppError.notFound('Vakit');
    }
    return this.worship.adjustQada(user.id, vakit as QadaKey, body.delta);
  }

  @Post('qada/estimate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Kaza calculator; with apply=true the result becomes the counters' })
  async estimate(@CurrentUser() user: AuthUser, @Body() body: QadaEstimateDto) {
    const { apply, ...input } = body;
    const estimate = this.worship.estimateQada(input);
    if (apply) {
      const per = estimate.perVakit;
      const counters = await this.worship.setQada(user.id, {
        sabah: per,
        ogle: per,
        ikindi: per,
        aksam: per,
        yatsi: per,
        vitir: per,
      });
      return { estimate, counters };
    }
    return { estimate };
  }

  @Get('dhikrs')
  @ApiOperation({ summary: 'Built-in and custom dhikr for the zikirmatik' })
  dhikrs(@CurrentUser() user: AuthUser) {
    return this.worship.dhikrs(user.id);
  }

  @Post('dhikrs')
  createDhikr(@CurrentUser() user: AuthUser, @Body() body: DhikrDto) {
    return this.worship.createDhikr(user.id, body);
  }

  @Patch('dhikrs/:id')
  updateDhikr(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DhikrPatchDto,
  ) {
    return this.worship.updateDhikr(user.id, id, body);
  }

  @Delete('dhikrs/:id')
  @HttpCode(204)
  async deleteDhikr(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.worship.deleteDhikr(user.id, id);
  }

  @Post('dhikr-sync')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Upload dhikr counted on the device',
    description:
      'Send deltas, not totals. Reuse the same batchId when retrying; an already applied batch returns applied=false and changes nothing.',
  })
  syncDhikr(@CurrentUser() user: AuthUser, @Body() body: DhikrSyncDto) {
    return this.worship.syncDhikr(user.id, body.batchId, body.entries);
  }

  @Get('dhikr-stats')
  @ApiOperation({ summary: 'Weekly/monthly totals, top dhikr, 15-week heatmap and streak' })
  stats(@CurrentUser() user: AuthUser, @Query() query: StatsQuery) {
    return this.worship.dhikrStats(user.id, query.range, query.today);
  }
}
