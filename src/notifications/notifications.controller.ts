import { Body, Controller, Delete, HttpCode, Param, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { type AuthUser, CurrentUser } from '../auth/auth.decorators.js';
import { NotificationsService } from './notifications.service.js';

class DeviceDto {
  @ApiProperty({ enum: ['ios', 'android', 'web'] })
  @IsIn(['ios', 'android', 'web'])
  platform: 'ios' | 'android' | 'web';

  @ApiPropertyOptional({ nullable: true, example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(255)
  pushToken?: string | null;

  @ApiPropertyOptional({ example: 'tr' })
  @IsOptional()
  @IsString()
  @Length(2, 10)
  locale?: string;

  @ApiPropertyOptional({ example: '1.0.0' })
  @IsOptional()
  @Matches(/^\d+\.\d+\.\d+([-+][\w.]+)?$/)
  appVersion?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(32)
  districtId?: string | null;

  @ApiPropertyOptional({ description: 'Notify when followed channels go live' })
  @IsOptional()
  @IsBoolean()
  liveAlerts?: boolean;

  @ApiPropertyOptional({ description: 'General announcements' })
  @IsOptional()
  @IsBoolean()
  announcements?: boolean;
}

@ApiTags('Me')
@ApiBearerAuth()
@Controller({ path: 'me/devices', version: '1' })
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Put(':installationId')
  @ApiOperation({
    summary: 'Register or update this install (push token, locale, alert preferences)',
    description:
      'Prayer-time alerts are scheduled locally on the phone and do not need the server; push is for live streams and announcements.',
  })
  upsert(
    @CurrentUser() user: AuthUser,
    @Param('installationId') installationId: string,
    @Body() body: DeviceDto,
  ) {
    return this.notifications.registerDevice(user.id, {
      ...body,
      installationId: installationId.slice(0, 128),
    });
  }

  @Delete(':installationId')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('installationId') installationId: string,
  ): Promise<void> {
    await this.notifications.removeDevice(user.id, installationId);
  }
}
