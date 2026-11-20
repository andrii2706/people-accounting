import { SetMetadata } from '@nestjs/common';
import { KEEP_FILE_INTACT } from '../../security/security.constants.js';

/**
 * The downloaded file goes out byte for byte: the document under the e-signature and the signature itself
 * (a mark of who downloaded it would change the bytes and break the signature). It is still counted.
 */
export const KeepFileIntact = () => SetMetadata(KEEP_FILE_INTACT, true);
