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
import { BlockCategory, Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
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

  // ── Global blocklist mutations affect every tenant → ADMIN only ──

  @Post('domains')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Add a single blocked domain (admin)' })
  add(@Body() dto: AddDomainDto) {
    return this.service.addDomain(dto.domain, dto.category, dto.wildcard ?? true);
  }

  @Post('domains/bulk')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Bulk import blocked domains (admin)' })
  bulk(@Body() dto: BulkImportDto) {
    return this.service.bulkImport(dto.items);
  }

  @Delete('domains/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a blocked domain (admin)' })
  remove(@Param('id') id: string) {
    return this.service.deleteDomain(id);
  }

  // ── Per-child category blocks are parent-scoped and ownership-checked ──

  @Post('children/:childId/categories')
  @ApiOperation({ summary: "Block/unblock a category for the caller's child" })
  setBlock(
    @CurrentUser('sub') parentId: string,
    @Param('childId') childId: string,
    @Body() dto: SetCategoryBlockDto,
  ) {
    return this.service.setCategoryBlock(
      parentId,
      childId,
      dto.category,
      dto.active,
      dto.reason,
    );
  }

  @Get('children/:childId/categories')
  @ApiOperation({ summary: "List category blocks for the caller's child" })
  listBlocks(
    @CurrentUser('sub') parentId: string,
    @Param('childId') childId: string,
  ) {
    return this.service.listCategoryBlocks(parentId, childId);
  }
}
