import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tck } from '../dictionaries/tck.entity.js';
import { EmployeesModule } from '../employees/employees.module.js';
import { ReportsModule } from '../reports/reports.module.js';
import { ChangeNotice } from './entities/change-notice.entity.js';
import { LetterSignature } from './entities/letter-signature.entity.js';
import { OutgoingLetter } from './entities/outgoing-letter.entity.js';
import { ChangeNoticesController, LettersController } from './letters.controller.js';
import { LettersService } from './letters.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([OutgoingLetter, LetterSignature, ChangeNotice, Tck]), EmployeesModule, ReportsModule],
  controllers: [LettersController, ChangeNoticesController],
  providers: [LettersService],
  exports: [LettersService],
})
export class LettersModule {}
