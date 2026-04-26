import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { AdminDomainsController } from './admin-domains.controller';

@Module({
  providers: [CategoriesService],
  controllers: [CategoriesController, AdminDomainsController],
  exports: [CategoriesService],
})
export class CategoriesModule {}
