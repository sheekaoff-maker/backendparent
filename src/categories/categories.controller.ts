import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BlockCategory } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CategoriesService } from './categories.service';
import {
  AddDomainDto,
  BulkImportDto,
  SetCategoryBlockDto,
} from './dto/category.dto';

@ApiTags('Categories & Blocklists')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/blocklists')
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Get('domains')
  @ApiOperation({ summary: 'List all blocked domains (optional category filter)' })
  list(@Query('category') category?: BlockCategory) {
    if (category) return this.service.listByCategory(category);
    return this.service.listAll();
  }

  @Post('domains')
  @ApiOperation({ summary: 'Add a single blocked domain' })
  add(@Body() dto: AddDomainDto) {
    return this.service.addDomain(dto.domain, dto.category, dto.wildcard ?? true);
  }

  @Post('domains/bulk')
  @ApiOperation({ summary: 'Bulk import blocked domains' })
  bulk(@Body() dto: BulkImportDto) {
    return this.service.bulkImport(dto.items);
  }

  @Delete('domains/:id')
  @ApiOperation({ summary: 'Delete a blocked domain' })
  remove(@Param('id') id: string) {
    return this.service.deleteDomain(id);
  }

  @Post('children/:childId/categories')
  @ApiOperation({ summary: 'Block/unblock a category for a child' })
  setBlock(@Param('childId') childId: string, @Body() dto: SetCategoryBlockDto) {
    return this.service.setCategoryBlock(childId, dto.category, dto.active, dto.reason);
  }

  @Get('children/:childId/categories')
  @ApiOperation({ summary: 'List category blocks for a child' })
  listBlocks(@Param('childId') childId: string) {
    return this.service.listCategoryBlocks(childId);
  }
}
