import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public, Roles } from '../common/decorators/auth.decorators.js';
import { SignupSignDto, SignupStatementDto } from './signup.dto.js';
import { SignupService } from './signup.service.js';

/** Sign-up of a company by its head with a qualified e-signature (docs/DEPLOYMENT.md § 6г-1). */
@ApiTags('auth')
@Controller()
export class SignupController {
  constructor(private readonly signup: SignupService) {}

  /** Is the sign-up open and how to sign (the IIT widget). */
  @Public()
  @Get('auth/register')
  info() {
    return this.signup.info();
  }

  /** Step 1: the code + the e-mail → the statement to sign. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @Post('auth/register/statement')
  statement(@Body() dto: SignupStatementDto, @Req() req: Request) {
    return this.signup.statement(dto, req.ip ?? '');
  }

  /** Step 2: the signature of the statement → the check with the ЄДР → the account or a refusal (403). */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @Post('auth/register/:id/sign')
  @HttpCode(200)
  sign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SignupSignDto) {
    return this.signup.sign(id, dto.signature);
  }

  /** The main administrator: approved and refused sign-ups. */
  @Roles('ADMIN')
  @Get('signups')
  list() {
    return this.signup.list();
  }
}
