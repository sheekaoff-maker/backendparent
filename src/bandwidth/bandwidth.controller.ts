import { Controller, Post, Get, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BandwidthService } from './bandwidth.service';
import { CreateBandwidthLimitDto, UpdateBandwidthLimitDto } from './dto/bandwidth.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Bandwidth')
@Controller('bandwidth-limits')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BandwidthController {
  constructor(private bandwidthService: BandwidthService) {}

  @Post()
  @ApiOperation({ summary: 'Create a bandwidth limit (Layer 7) — scoped to a child or a device, optionally a category' })
  async create(@CurrentUser('sub') parentId: string, @Body() dto: CreateBandwidthLimitDto) {
    return this.bandwidthService.create(parentId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all bandwidth limits' })
  async findAll(@CurrentUser('sub') parentId: string) {
    return this.bandwidthService.findAll(parentId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a bandwidth limit by ID' })
  async findOne(@CurrentUser('sub') parentId: string, @Param('id') id: string) {
    return this.bandwidthService.findOne(parentId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a bandwidth limit (dynamic update — the gateway applies it on its next poll)' })
  async update(@CurrentUser('sub') parentId: string, @Param('id') id: string, @Body() dto: UpdateBandwidthLimitDto) {
    return this.bandwidthService.update(parentId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a bandwidth limit' })
  async remove(@CurrentUser('sub') parentId: string, @Param('id') id: string) {
    await this.bandwidthService.remove(parentId, id);
  }
}
