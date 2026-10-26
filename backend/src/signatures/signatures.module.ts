import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LetterSignature } from '../letters/entities/letter-signature.entity.js';
import { OutgoingLetter } from '../letters/entities/outgoing-letter.entity.js';
import { LettersModule } from '../letters/letters.module.js';
import { SignaturesController } from './signatures.controller.js';
import { SignaturesService } from './signatures.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([OutgoingLetter, LetterSignature]), LettersModule],
  controllers: [SignaturesController],
  providers: [SignaturesService],
})
export class SignaturesModule {}
