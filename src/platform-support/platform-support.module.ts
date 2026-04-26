import { Module } from '@nestjs/common';
import { PlatformSupportController } from './platform-support.controller';

@Module({
  controllers: [PlatformSupportController],
})
export class PlatformSupportModule {}
