import { BadRequestException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../shared/interfaces/auth.interface.js';
import type { UploadKind } from '../shared/interfaces/security.interface.js';
import { SecurityService } from './security.service.js';
import { actorOf } from './utils/security.utils.js';
import { inspectUpload } from './utils/file-safety.utils.js';

/**
 * The gate every uploaded file passes before it is read or stored. A file with a program, macro, script or
 * a link to outside content is refused; a real threat goes to the security journal and to the administrators.
 */
@Injectable()
export class UploadGuardService {
  constructor(private readonly security: SecurityService) {}

  async assertSafe(
    buffer: Buffer,
    fileName: string,
    kind: UploadKind,
    who: { user?: Partial<AuthUser> | null; req?: Pick<Request, 'ip' | 'headers'> },
  ): Promise<void> {
    const verdict = await inspectUpload(buffer, fileName, kind);
    if (!verdict) return;
    if (verdict.dangerous) {
      const actor = who.req
        ? actorOf(who.req, who.user)
        : { userId: who.user?.id ?? null, userName: who.user?.fullName, legalEntityId: who.user?.legalEntityId };
      await this.security.record('UPLOAD_BLOCKED', actor, { file: fileName.slice(0, 120), reason: verdict.reason });
    }
    throw new BadRequestException(verdict.message);
  }
}
