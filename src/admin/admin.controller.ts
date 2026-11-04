import { InjectQueue } from '@nestjs/bullmq';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import type { Queue } from 'bullmq';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { type AuthUser, CurrentUser, Roles } from '../auth/auth.decorators.js';
import { jobId, JOBS, QUEUES } from '../jobs/queues.js';
import { LIVE_CATEGORIES } from '../live/live.controller.js';
import { type LiveCategory, LiveService } from '../live/live.service.js';
import { LocationsService } from '../locations/locations.service.js';
import { MosquesService } from '../mosques/mosques.service.js';
import { type Audience, NotificationsService } from '../notifications/notifications.service.js';
import { AdminService, type ResolveAction } from './admin.service.js';

class ListQuery {
  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 50;
}

class ReportQueueQuery extends ListQuery {
  @ApiPropertyOptional({ enum: ['open', 'actioned', 'dismissed'], default: 'open' })
  @IsOptional()
  @IsIn(['open', 'actioned', 'dismissed'])
  status: 'open' | 'actioned' | 'dismissed' = 'open';
}

class ResolveDto {
  @ApiProperty({ enum: ['dismiss', 'remove', 'remove_and_mute', 'remove_and_ban'] })
  @IsIn(['dismiss', 'remove', 'remove_and_mute', 'remove_and_ban'])
  action: ResolveAction;

  @ApiPropertyOptional({ description: 'Mute/ban length in hours', default: 24 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24 * 365 * 10)
  durationHours?: number;
}

class DurationDto {
  @ApiProperty({ example: 24 })
  @IsInt()
  @Min(1)
  @Max(24 * 365 * 10)
  hours: number;
}

class RoleDto {
  @ApiProperty({ enum: ['user', 'moderator', 'admin'] })
  @IsIn(['user', 'moderator', 'admin'])
  role: 'user' | 'moderator' | 'admin';
}

class UserSearchQuery extends ListQuery {
  @ApiPropertyOptional({ description: 'E-mail, display name or id' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

class ChannelDto {
  @ApiProperty({ description: 'Channel id (UC…), @handle or channel URL' })
  @IsString()
  @MaxLength(200)
  channel: string;

  @ApiPropertyOptional({ enum: LIVE_CATEGORIES })
  @IsOptional()
  @IsIn(LIVE_CATEGORIES)
  category?: LiveCategory;

  @ApiPropertyOptional({ example: 'ar' })
  @IsOptional()
  @IsString()
  @Length(2, 10)
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(-100)
  @Max(100)
  priority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyOnLive?: boolean;
}

class ChannelPatchDto {
  @ApiPropertyOptional({ enum: LIVE_CATEGORIES })
  @IsOptional()
  @IsIn(LIVE_CATEGORIES)
  category?: LiveCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 10)
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(-100)
  @Max(100)
  priority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyOnLive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

class PinDto {
  @ApiProperty({ example: 'dQw4w9WgXcQ' })
  @Matches(/^[\w-]{11}$/)
  videoId: string;
}

class SuggestionQuery extends ListQuery {
  @ApiPropertyOptional({ enum: ['open', 'accepted', 'rejected'], default: 'open' })
  @IsOptional()
  @IsIn(['open', 'accepted', 'rejected'])
  status: 'open' | 'accepted' | 'rejected' = 'open';
}

class ReviewDto {
  @ApiProperty()
  @IsBoolean()
  accept: boolean;
}

class LocationDto {
  @ApiProperty()
  @IsNumber()
  @IsLatitude()
  lat: number;

  @ApiProperty()
  @IsNumber()
  @IsLongitude()
  lng: number;
}

class BroadcastDto {
  @ApiProperty()
  @IsString()
  @Length(1, 80)
  title: string;

  @ApiProperty()
  @IsString()
  @Length(1, 300)
  body: string;

  @ApiPropertyOptional({ enum: ['all', 'announcements'], default: 'announcements' })
  @IsOptional()
  @IsIn(['all', 'announcements'])
  audience: Audience = 'announcements';

  @ApiPropertyOptional({ description: 'Only devices with this locale' })
  @IsOptional()
  @IsString()
  @Length(2, 10)
  locale?: string;
}

class RoomDto {
  @ApiProperty({ example: 'de' })
  @Matches(/^[a-z0-9_-]{1,32}$/)
  id: string;

  @ApiProperty()
  @IsString()
  @Length(1, 40)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 10)
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3600)
  slowModeSeconds?: number;
}

class RoomPatchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 40)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3600)
  slowModeSeconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Moderation and operations endpoints. Moderators handle content; admins everything. */
@ApiTags('Admin')
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly live: LiveService,
    private readonly mosques: MosquesService,
    private readonly locations: LocationsService,
    private readonly notifications: NotificationsService,
    @InjectQueue(QUEUES.locations) private readonly locationsQueue: Queue,
    @InjectQueue(QUEUES.live) private readonly liveQueue: Queue,
  ) {}

  // ---- chat moderation -----------------------------------------------------

  @Roles('moderator', 'admin')
  @Get('reports')
  @ApiOperation({ summary: 'Reported messages, grouped and sorted by number of reporters' })
  reports(@Query() query: ReportQueueQuery) {
    return this.admin.reportQueue(query.status, query.limit);
  }

  @Roles('moderator', 'admin')
  @Post('reports/messages/:messageId/resolve')
  @HttpCode(204)
  async resolve(
    @CurrentUser() user: AuthUser,
    @Param('messageId', ParseIntPipe) messageId: number,
    @Body() body: ResolveDto,
  ): Promise<void> {
    await this.admin.resolveReports(user.id, messageId, body.action, body.durationHours);
  }

  @Roles('moderator', 'admin')
  @Get('users')
  users(@Query() query: UserSearchQuery) {
    return this.admin.searchUsers(query.q, query.limit);
  }

  @Roles('moderator', 'admin')
  @Post('users/:id/mute')
  @HttpCode(204)
  async mute(@Param('id', ParseUUIDPipe) id: string, @Body() body: DurationDto): Promise<void> {
    await this.admin.mute(id, body.hours);
  }

  @Roles('moderator', 'admin')
  @Post('users/:id/ban')
  @HttpCode(204)
  async ban(@Param('id', ParseUUIDPipe) id: string, @Body() body: DurationDto): Promise<void> {
    await this.admin.ban(id, body.hours);
  }

  @Roles('moderator', 'admin')
  @Post('users/:id/unban')
  @HttpCode(204)
  async unban(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.admin.unban(id);
  }

  @Roles('admin')
  @Put('users/:id/role')
  @HttpCode(204)
  async role(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RoleDto,
  ): Promise<void> {
    await this.admin.setRole(user.id, id, body.role);
  }

  @Roles('admin')
  @Post('chat/rooms')
  createRoom(@Body() body: RoomDto) {
    return this.admin.createRoom(body);
  }

  @Roles('admin')
  @Patch('chat/rooms/:roomId')
  updateRoom(@Param('roomId') roomId: string, @Body() body: RoomPatchDto) {
    return this.admin.updateRoom(roomId, body);
  }

  // ---- live streams -----------------------------------------------------

  @Roles('admin')
  @Get('live/channels')
  liveChannels() {
    return this.live.adminChannels();
  }

  @Roles('admin')
  @Post('live/channels')
  @ApiOperation({ summary: 'Add a YouTube channel to watch for live streams' })
  addChannel(@Body() body: ChannelDto) {
    return this.live.addChannel(body);
  }

  @Roles('admin')
  @Patch('live/channels/:id')
  updateChannel(@Param('id', ParseUUIDPipe) id: string, @Body() body: ChannelPatchDto) {
    return this.live.updateChannel(id, body);
  }

  @Roles('admin')
  @Delete('live/channels/:id')
  @HttpCode(204)
  async removeChannel(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.live.removeChannel(id);
  }

  @Roles('admin')
  @Post('live/channels/:id/pin')
  @ApiOperation({ summary: 'Always track a specific video (e.g. a 24/7 Haramain stream)' })
  pin(@Param('id', ParseUUIDPipe) id: string, @Body() body: PinDto) {
    return this.live.pinStream(id, body.videoId);
  }

  @Roles('admin')
  @Delete('live/streams/:videoId/pin')
  @HttpCode(204)
  async unpin(@Param('videoId') videoId: string): Promise<void> {
    await this.live.unpinStream(videoId);
  }

  @Roles('admin')
  @Post('live/poll')
  @HttpCode(202)
  async poll() {
    await this.liveQueue.add(
      JOBS.pollLiveStreams,
      {},
      { jobId: jobId('poll', 'manual', Date.now()) },
    );
    return { queued: true };
  }

  // ---- mosques -----------------------------------------------------------

  @Roles('moderator', 'admin')
  @Get('mosques/suggestions')
  suggestions(@Query() query: SuggestionQuery) {
    return this.mosques.listSuggestions(query.status, query.limit);
  }

  @Roles('moderator', 'admin')
  @Post('mosques/suggestions/:id/review')
  @HttpCode(204)
  async review(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReviewDto,
  ): Promise<void> {
    await this.mosques.reviewSuggestion(id, user.id, body.accept);
  }

  // ---- locations & notifications ------------------------------------------

  @Roles('admin')
  @Put('districts/:id/location')
  @HttpCode(204)
  @ApiOperation({ summary: 'Fix a district’s coordinates (also sets its time zone)' })
  async districtLocation(@Param('id') id: string, @Body() body: LocationDto): Promise<void> {
    await this.locations.setDistrictLocation(id, body, true);
  }

  @Roles('admin')
  @Post('sync/locations')
  @HttpCode(202)
  async syncLocations() {
    await this.locationsQueue.add(
      JOBS.syncAllLocations,
      {},
      { jobId: jobId('sync', 'manual', Date.now()) },
    );
    return { queued: true };
  }

  @Roles('admin')
  @Post('notifications/broadcast')
  @HttpCode(202)
  async broadcast(@Body() body: BroadcastDto) {
    const jobId = await this.notifications.enqueueBroadcast({
      ...body,
      data: { type: 'announcement' },
    });
    return { queued: true, jobId };
  }
}
