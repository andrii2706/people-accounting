import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, StreamableFile } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuditService } from '../audit/audit.service.js';
import { type AuthUser, CurrentUser } from '../common/auth.js';
import { DOCX_MIME, P7S_MIME } from '../letters/letters.service.js';
import { AddSignatureDto } from './signatures.dto.js';
import { SignaturesService } from './signatures.service.js';

function file(buffer: Buffer, filename: string, type: string) {
  return new StreamableFile(buffer, {
    type,
    disposition: `attachment; filename="file"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  });
}

@ApiTags('signatures')
@Controller()
export class SignaturesController {
  constructor(
    private readonly signatures: SignaturesService,
    private readonly audit: AuditService,
  ) {}

  /** Налаштування підписання для фронтенду (віджет ІІТ, сервіс перевірки). */
  @Get('signatures/config')
  config() {
    return this.signatures.config();
  }

  @Get('letters/:id/signatures')
  state(@Param('id', ParseUUIDPipe) id: string) {
    return this.signatures.state(id);
  }

  /** Зафіксувати документ: далі підписується і надсилається саме цей файл. */
  @Post('letters/:id/freeze')
  @HttpCode(200)
  freeze(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.signatures.freeze(id, user);
  }

  @Delete('letters/:id/freeze')
  unfreeze(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.signatures.unfreeze(id, user);
  }

  /** Байти документа для підписання (саме їх треба підписати). */
  @Get('letters/:id/signing-file')
  async signingFile(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    const { buffer, filename } = await this.signatures.frozenDocument(id);
    await this.audit.log('letter', id, 'EXPORT', { file: [null, filename] }, user);
    return file(buffer, filename, DOCX_MIME);
  }

  @Post('letters/:id/signatures')
  add(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddSignatureDto, @CurrentUser() user: AuthUser) {
    return this.signatures.add(id, dto.signature, dto.method, user);
  }

  @Get('letters/:id/signatures/:signatureId/file')
  async signatureFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('signatureId', ParseUUIDPipe) signatureId: string,
  ) {
    const { buffer, filename } = await this.signatures.signatureFile(id, signatureId);
    return file(buffer, filename, P7S_MIME);
  }

  /** ZIP із документом і всіма підписами. */
  @Get('letters/:id/signed-package')
  async signedPackage(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    const { buffer, filename } = await this.signatures.signedPackage(id);
    await this.audit.log('letter', id, 'EXPORT', { file: [null, filename] }, user);
    return file(buffer, filename, 'application/zip');
  }
}
