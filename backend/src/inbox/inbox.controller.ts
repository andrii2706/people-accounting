import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/auth.js';
import type { AuthUser } from '../shared/interfaces/auth.interface.js';
import { InboxService } from './inbox.service.js';

class MarkReadDto {
  @IsArray()
  @ArrayMaxSize(2000)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  keys: string[];
}

/** In-app notifications of the signed-in user (bell in the menu and the window after login). */
@ApiTags('inbox')
@Controller('inbox')
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.inbox.list(user.id);
  }

  @Post('read')
  @HttpCode(204)
  async read(@CurrentUser() user: AuthUser, @Body() dto: MarkReadDto) {
    await this.inbox.markRead(user.id, dto.keys);
  }

  @Post('read-all')
  @HttpCode(204)
  async readAll(@CurrentUser() user: AuthUser) {
    await this.inbox.markAllRead(user.id);
  }
}
