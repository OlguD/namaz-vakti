import { Module } from '@nestjs/common';
import { CoreModule } from '../core.module.js';
import { LiveModule } from '../live/live.module.js';
import { MosquesModule } from '../mosques/mosques.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PrayerTimesModule } from '../prayer-times/prayer-times.module.js';
import { WorshipModule } from '../worship/worship.module.js';
import {
  GeocodeProcessor,
  LiveProcessor,
  LocationsProcessor,
  MaintenanceProcessor,
  MosquesProcessor,
  NotificationsProcessor,
  PrayerTimesProcessor,
} from './processors.js';
import { SchedulesService } from './schedules.service.js';

/** Background process: queue consumers and recurring schedules. No HTTP server. */
@Module({
  imports: [
    CoreModule,
    PrayerTimesModule,
    MosquesModule,
    LiveModule,
    NotificationsModule,
    WorshipModule,
  ],
  providers: [
    LocationsProcessor,
    GeocodeProcessor,
    MaintenanceProcessor,
    PrayerTimesProcessor,
    MosquesProcessor,
    LiveProcessor,
    NotificationsProcessor,
    SchedulesService,
  ],
})
export class WorkerModule {}
