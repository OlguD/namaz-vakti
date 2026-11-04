import { Global, Module } from '@nestjs/common';
import { GeocoderService } from '../locations/geocoder.service.js';
import { LocationsController } from '../locations/locations.controller.js';
import { LocationsService } from '../locations/locations.service.js';
import { PrayerTimesController } from './prayer-times.controller.js';
import { PrayerTimesService } from './prayer-times.service.js';
import { EmushafProvider } from './providers/emushaf.provider.js';
import { PRAYER_TIMES_PROVIDER } from './providers/provider.js';

/**
 * Locations and prayer times share the upstream provider, so they live in one
 * module. To switch to the official Diyanet API, bind PRAYER_TIMES_PROVIDER to a
 * DiyanetProvider here.
 */
@Global()
@Module({
  controllers: [LocationsController, PrayerTimesController],
  providers: [
    EmushafProvider,
    { provide: PRAYER_TIMES_PROVIDER, useExisting: EmushafProvider },
    LocationsService,
    GeocoderService,
    PrayerTimesService,
  ],
  exports: [LocationsService, GeocoderService, PrayerTimesService, PRAYER_TIMES_PROVIDER],
})
export class PrayerTimesModule {}
