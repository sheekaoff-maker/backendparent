import { Module } from '@nestjs/common';
import { ParentsService } from './parents.service';
import { ParentsController } from './parents.controller';
import { LegalController } from './legal.controller';

@Module({
  controllers: [ParentsController, LegalController],
  providers: [ParentsService],
  exports: [ParentsService],
})
export class ParentsModule {}
