import {
  type CallHandler,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  type NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { mergeMap, type Observable } from 'rxjs';
import { Repository } from 'typeorm';
import { loadEnv } from '../config/env.js';
import { LetterSignature } from '../letters/entities/letter-signature.entity.js';
import { OutgoingLetter } from '../letters/entities/outgoing-letter.entity.js';
import type { AuthenticatedRequest } from '../shared/interfaces/auth.interface.js';
import { EXPORT_LIMIT_MESSAGE, KEEP_FILE_INTACT } from './security.constants.js';
import { SecurityService } from './security.service.js';
import { actorOf, clientIp } from './utils/security.utils.js';
import { dispositionFileName, stampOfficeFile, stampText } from './utils/file-stamp.utils.js';

const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');

async function toBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks);
}

/**
 * Every file the API gives out: counted against the limit of the account (per hour / day), recorded with its
 * SHA-256 (to answer «who downloaded this file») and — Word / Excel — marked in the file properties with the
 * number of the download, the name and the time. The document under the e-signature is never changed.
 */
@Injectable()
export class ExportInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ExportInterceptor.name);
  private readonly env = loadEnv();

  constructor(
    private readonly reflector: Reflector,
    private readonly security: SecurityService,
    @InjectRepository(OutgoingLetter) private readonly letters: Repository<OutgoingLetter>,
    @InjectRepository(LetterSignature) private readonly signatures: Repository<LetterSignature>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const intact = this.reflector.getAllAndOverride<boolean>(KEEP_FILE_INTACT, [
      context.getHandler(),
      context.getClass(),
    ]);
    return next.handle().pipe(
      mergeMap(async (body: unknown) => {
        if (!(body instanceof StreamableFile) || !req.user) return body;
        return this.deliver(body, req, !!intact);
      }),
    );
  }

  private async deliver(file: StreamableFile, req: AuthenticatedRequest, intact: boolean) {
    const user = req.user;
    await this.assertLimit(req);
    const original = await toBuffer(file.getStream());
    const fileName = dispositionFileName(file.options.disposition);
    const id = randomUUID();
    let out = original;
    if (!intact && !(await this.isSigned(sha256(original)))) {
      try {
        out = (await stampOfficeFile(original, stampText(id, user.fullName, new Date()))) ?? original;
      } catch (err) {
        this.logger.warn(`Не вдалося позначити файл «${fileName}»: ${(err as Error).message}`);
      }
    }
    await this.security.recordExport({
      id,
      userId: user.id,
      legalEntityId: user.legalEntityId ?? null,
      path: (req.originalUrl ?? req.url ?? '').split('?')[0].slice(0, 200),
      fileName,
      bytes: out.length,
      sha256: sha256(out),
      ip: clientIp(req),
    });
    return new StreamableFile(out, { ...file.options, length: out.length });
  }

  /** A document frozen for signing or already signed — its bytes are what the signature covers. */
  private async isSigned(hash: string) {
    return (
      (await this.letters.existsBy({ documentSha256: hash })) ||
      (await this.signatures.existsBy({ documentSha256: hash }))
    );
  }

  private async assertLimit(req: AuthenticatedRequest) {
    const { exportLimitPerHour: perHour, exportLimitPerDay: perDay } = this.env;
    if (!perHour && !perDay) return;
    const used = await this.security.exportsSince(req.user.id);
    const over =
      perHour && used.hour >= perHour
        ? { limit: perHour, period: 'годину' }
        : perDay && used.day >= perDay
          ? { limit: perDay, period: 'добу' }
          : null;
    if (!over) return;
    await this.security.record('EXPORT_LIMIT', actorOf(req, req.user), { limit: over.limit, period: over.period });
    throw new HttpException(
      EXPORT_LIMIT_MESSAGE.replace('{limit}', String(over.limit)).replace('{period}', over.period),
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
