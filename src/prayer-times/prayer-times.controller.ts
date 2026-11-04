import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Public } from '../auth/auth.decorators.js';
import { PrayerTimesService } from './prayer-times.service.js';

class RangeQuery {
  @ApiPropertyOptional({ minimum: 1, maximum: 30, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  days = 30;

  @ApiPropertyOptional({
    description: 'First day, YYYY-MM-DD. Defaults to today in the district’s time zone.',
    example: '2026-11-04',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;
}

class NearbyQuery {
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

  @ApiPropertyOptional({ minimum: 1, maximum: 30, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  days = 30;
}

@ApiTags('Prayer times')
@Public()
@Controller({ path: 'prayer-times', version: '1' })
export class PrayerTimesController {
  constructor(private readonly prayerTimes: PrayerTimesService) {}

  @Get('districts/:districtId')
  @ApiOperation({
    summary: 'Daily prayer times for a district (Diyanet tables)',
    description: [
      'Each day has local `times` ("HH:mm" as published) and `instants` (UTC ISO strings) for scheduling notifications.',
      'Ramadan: iftar = `aksam`, sahur ends at `imsak`; `isRamadan` flags those days.',
      '`stale: true` means the upstream was unreachable and stored data is being served.',
      '`source: "calculated"` means no official table was available and times were computed locally.',
    ].join('\n\n'),
  })
  district(@Param('districtId') districtId: string, @Query() query: RangeQuery) {
    return this.prayerTimes.forDistrict(districtId, query.days, query.from);
  }

  @Get('nearby')
  @ApiOperation({
    summary: 'Prayer times for a GPS position',
    description: 'Uses the nearest district within 75 km, else calculates for the exact position.',
  })
  nearby(@Query() query: NearbyQuery) {
    return this.prayerTimes.forCoordinates(query.lat, query.lng, query.days);
  }
}
