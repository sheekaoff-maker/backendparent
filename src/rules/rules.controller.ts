import { Controller, Post, Get, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RulesService } from './rules.service';
import { CreateRuleDto, UpdateRuleDto } from './dto/rule.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Rules')
@Controller('rules')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RulesController {
  constructor(private rulesService: RulesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a rule' })
  async create(@Body() dto: CreateRuleDto) {
    return this.rulesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all rules for parent' })
  async findAll(@CurrentUser('sub') parentId: string) {
    return this.rulesService.findAll(parentId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a rule' })
  async update(@Param('id') id: string, @Body() dto: UpdateRuleDto) {
    return this.rulesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a rule' })
  async remove(@Param('id') id: string) {
    await this.rulesService.remove(id);
  }
}
