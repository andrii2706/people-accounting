import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DictionariesController } from './dictionaries.controller.js';
import { Tck } from './tck.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Tck])],
  controllers: [DictionariesController],
  exports: [TypeOrmModule],
})
export class DictionariesModule {}
