import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/auth.decorators.js';
import { CoordinatesQuery } from '../common/dto.js';
import { LocationsService } from './locations.service.js';
import { distanceToKaabaKm, KAABA, qiblaBearing } from './qibla.js';

const CACHE_DAY = 'public, max-age=86400, stale-while-revalidate=604800';

@ApiTags('Locations')
@Public()
@Controller({ path: 'locations', version: '1' })
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get('countries')
  @Header('Cache-Control', CACHE_DAY)
  @ApiOperation({ summary: 'All countries with published prayer times' })
  countries() {
    return this.locations.listCountries();
  }

  @Get('countries/:countryId/cities')
  @Header('Cache-Control', CACHE_DAY)
  cities(@Param('countryId') countryId: string) {
    return this.locations.listCities(countryId);
  }

  @Get('cities/:cityId/districts')
  @Header('Cache-Control', CACHE_DAY)
  districts(@Param('cityId') cityId: string) {
    return this.locations.listDistricts(cityId);
  }

  @Get('districts/:districtId')
  @ApiOperation({ summary: 'One district with its city, country, coordinates and time zone' })
  district(@Param('districtId') districtId: string) {
    return this.locations.getDistrict(districtId);
  }

  @Get('nearest')
  @ApiOperation({
    summary: 'Nearest district to a GPS position',
    description: `Returns null when no district with known coordinates is within 75 km; the app should then fall back to the manual country → city → district picker.`,
  })
  nearest(@Query() { lat, lng }: CoordinatesQuery) {
    return this.locations.nearest(lat, lng);
  }

  @Get('qibla')
  @Header('Cache-Control', CACHE_DAY)
  @ApiOperation({
    summary: 'Qibla bearing (true north) and distance to the Kaaba',
    description:
      'The app can compute this offline too; this endpoint exists for widgets and the web.',
  })
  qibla(@Query() { lat, lng }: CoordinatesQuery) {
    return {
      bearing: Math.round(qiblaBearing(lat, lng) * 10) / 10,
      distanceKm: Math.round(distanceToKaabaKm(lat, lng)),
      kaaba: KAABA,
    };
  }
}
