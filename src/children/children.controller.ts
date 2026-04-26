import { Controller, Post, Get, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ChildrenService } from './children.service';
import { CreateChildDto, UpdateChildDto } from './dto/child.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Children')
@Controller('children')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChildrenController {
  constructor(private childrenService: ChildrenService) {}

  @Post()
  @ApiOperation({ summary: 'Create a child profile' })
  async create(@CurrentUser('sub') parentId: string, @Body() dto: CreateChildDto) {
    return this.childrenService.create(parentId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all children' })
  async findAll(@CurrentUser('sub') parentId: string) {
    return this.childrenService.findAll(parentId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get child by ID' })
  async findOne(@CurrentUser('sub') parentId: string, @Param('id') id: string) {
    return this.childrenService.findOne(parentId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update child profile' })
  async update(@CurrentUser('sub') parentId: string, @Param('id') id: string, @Body() dto: UpdateChildDto) {
    return this.childrenService.update(parentId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete child profile' })
  async remove(@CurrentUser('sub') parentId: string, @Param('id') id: string) {
    await this.childrenService.remove(parentId, id);
  }
}
