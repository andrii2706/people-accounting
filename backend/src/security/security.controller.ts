import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EntityScope, Roles } from '../common/decorators/auth.decorators.js';
import type { Scope } from '../shared/interfaces/auth.interface.js';
import { ExportTraceDto, SecurityEventsQueryDto } from './security.dto.js';
import { SecurityService } from './security.service.js';

/** The security journal of the legal entity (the main administrator — of all) and «who downloaded this file». */
@ApiTags('security')
@Roles('ADMIN', 'ENTITY_ADMIN', 'DIRECTOR')
@Controller('security')
export class SecurityController {
  constructor(private readonly security: SecurityService) {}

  @Get('events')
  events(@Query() query: SecurityEventsQueryDto, @EntityScope() scope: Scope) {
    return this.security.list(scope, query);
  }

  /** The hash is computed in the browser: the file itself is not sent. */
  @Post('trace')
  @HttpCode(200)
  trace(@Body() dto: ExportTraceDto, @EntityScope() scope: Scope) {
    return this.security.trace(dto.sha256, scope);
  }
}
