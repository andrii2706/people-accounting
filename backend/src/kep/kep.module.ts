import { Global, Module } from '@nestjs/common';
import { KepVerifierService } from './kep-verifier.service.js';

@Global()
@Module({
  providers: [KepVerifierService],
  exports: [KepVerifierService],
})
export class KepModule {}
