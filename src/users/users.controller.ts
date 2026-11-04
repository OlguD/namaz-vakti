import { Body, Controller, Delete, Get, HttpCode, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser } from '../auth/auth.decorators.js';
import { UpdateMeDto } from './dto.js';
import { UsersService } from './users.service.js';

@ApiTags('Me')
@ApiBearerAuth()
@Controller({ path: 'me', version: '1' })
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Current account profile' })
  me(@CurrentUser() user: AuthUser) {
    return this.users.profile(user.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update display name, locale or default district' })
  update(@CurrentUser() user: AuthUser, @Body() body: UpdateMeDto) {
    return this.users.update(user.id, body);
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({
    summary: 'Permanently delete the account and all its data',
    description: 'Required by App Store and Google Play. Not reversible.',
  })
  @ApiNoContentResponse()
  async remove(@CurrentUser() user: AuthUser): Promise<void> {
    await this.users.deleteAccount(user.id);
  }
}
