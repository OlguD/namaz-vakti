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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { type AuthUser, CurrentUser, RegisteredOnly } from '../auth/auth.decorators.js';
import { AppError } from '../common/errors.js';
import { QuranService } from './quran.service.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

class TodayQuery {
  @ApiPropertyOptional({
    description: 'The user’s local day; enables pagesPerDay',
    example: '2026-11-04',
  })
  @IsOptional()
  @Matches(ISO_DATE)
  today?: string;
}

class ProgressDto {
  @ApiProperty({ description: 'Juz finished in the current khatm', minimum: 0, maximum: 30 })
  @IsInt()
  @Min(0)
  @Max(30)
  juz: number;

  @ApiProperty({ description: 'Pages read in the next juz', minimum: 0, maximum: 19 })
  @IsInt()
  @Min(0)
  @Max(19)
  page: number;

  @ApiPropertyOptional({ nullable: true, example: '2027-03-04' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(ISO_DATE)
  targetDate?: string | null;
}

class ReadDto {
  @ApiProperty({ minimum: 1, maximum: 604, example: 4 })
  @IsInt()
  @Min(1)
  @Max(604)
  pages: number;

  @ApiProperty({ example: '2026-11-04' })
  @Matches(ISO_DATE)
  date: string;
}

class CreateHatimDto {
  @ApiProperty({ example: 'Ailecek hatim' })
  @IsString()
  @Length(2, 60)
  name: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(ISO_DATE)
  targetDate?: string | null;
}

class UpdateHatimDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 60)
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(ISO_DATE)
  targetDate?: string | null;
}

class JoinDto {
  @ApiProperty({ example: 'K7M2QX9P' })
  @Matches(/^[A-Za-z0-9]{6,12}$/)
  code: string;
}

function juzParam(value: number): number {
  if (value < 1 || value > 30) {
    throw AppError.notFound('Juz');
  }
  return value;
}

@ApiTags('Quran')
@ApiBearerAuth()
@Controller({ path: 'quran', version: '1' })
export class QuranController {
  constructor(private readonly quran: QuranService) {}

  // ---- personal ---------------------------------------------------------------

  @Get('progress')
  progress(@CurrentUser() user: AuthUser, @Query() query: TodayQuery) {
    return this.quran.progress(user.id, query.today);
  }

  @Put('progress')
  setProgress(@CurrentUser() user: AuthUser, @Body() body: ProgressDto) {
    return this.quran.setProgress(user.id, body);
  }

  @Post('progress/read')
  @HttpCode(200)
  @ApiOperation({ summary: 'Record pages read; wraps into a new khatm after 30 juz' })
  read(@CurrentUser() user: AuthUser, @Body() body: ReadDto) {
    return this.quran.read(user.id, body.pages, body.date);
  }

  // ---- group khatm (needs a registered account and a display name) ------------------

  @RegisteredOnly()
  @Get('hatims')
  groups(@CurrentUser() user: AuthUser) {
    return this.quran.myGroups(user.id);
  }

  @RegisteredOnly()
  @Post('hatims')
  create(@CurrentUser() user: AuthUser, @Body() body: CreateHatimDto) {
    return this.quran.create(user.id, body.name, body.targetDate ?? null);
  }

  @RegisteredOnly()
  @Post('hatims/join')
  @HttpCode(200)
  @ApiOperation({ summary: 'Join with an invite code (idempotent)' })
  join(@CurrentUser() user: AuthUser, @Body() body: JoinDto) {
    return this.quran.join(user.id, body.code);
  }

  @RegisteredOnly()
  @Get('hatims/:id')
  @ApiOperation({ summary: 'Group detail: 30-juz grid, members, invite code' })
  detail(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.quran.detail(user.id, id);
  }

  @RegisteredOnly()
  @Patch('hatims/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateHatimDto,
  ) {
    return this.quran.update(user.id, id, body);
  }

  @RegisteredOnly()
  @Delete('hatims/:id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.quran.remove(user.id, id);
  }

  @RegisteredOnly()
  @Post('hatims/:id/take-next')
  @HttpCode(200)
  @ApiOperation({ summary: 'Take the lowest open juz' })
  takeNext(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.quran.take(user.id, id, 'next');
  }

  @RegisteredOnly()
  @Post('hatims/:id/juz/:juz/take')
  @HttpCode(200)
  @ApiOperation({ summary: 'Take a specific juz; 409 if someone was faster' })
  take(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('juz', ParseIntPipe) juz: number,
  ) {
    return this.quran.take(user.id, id, juzParam(juz));
  }

  @RegisteredOnly()
  @Post('hatims/:id/juz/:juz/read')
  @HttpCode(200)
  markRead(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('juz', ParseIntPipe) juz: number,
  ) {
    return this.quran.markRead(user.id, id, juzParam(juz));
  }

  @RegisteredOnly()
  @Post('hatims/:id/juz/:juz/release')
  @HttpCode(200)
  release(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('juz', ParseIntPipe) juz: number,
  ) {
    return this.quran.release(user.id, id, juzParam(juz));
  }

  @RegisteredOnly()
  @Post('hatims/:id/new-round')
  @HttpCode(200)
  newRound(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.quran.newRound(user.id, id);
  }

  @RegisteredOnly()
  @Post('hatims/:id/invite/rotate')
  @HttpCode(200)
  @ApiOperation({ summary: 'New invite code; old links stop working' })
  rotate(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.quran.rotateInvite(user.id, id);
  }

  @RegisteredOnly()
  @Delete('hatims/:id/members/me')
  @HttpCode(204)
  async leave(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.quran.leave(user.id, id);
  }

  @RegisteredOnly()
  @Delete('hatims/:id/members/:userId')
  kick(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) memberId: string,
  ) {
    return this.quran.kick(user.id, id, memberId);
  }
}
