import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CategoriesService } from './categories.service';
import { ClassifyDomainDto } from './dto/category.dto';

@ApiTags('Domain Learning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/domains')
export class AdminDomainsController {
  constructor(private readonly service: CategoriesService) {}

  @Get('unknown')
  @ApiOperation({
    summary:
      'List uncategorised domains seen by our DNS, sorted by hit-count. Use POST /classify to teach the system.',
  })
  unknown(
    @Query('limit') limit?: string,
    @Query('classified') classified?: string,
  ) {
    const opts: { limit?: number; classified?: boolean } = {};
    if (limit) opts.limit = parseInt(limit, 10);
    if (classified === 'true') opts.classified = true;
    if (classified === 'false') opts.classified = false;
    return this.service.listUnknownDomains(opts);
  }

  @Post('classify')
  @ApiOperation({
    summary:
      'Classify an unknown domain into a real BlockedDomain entry and mark every matching unknown-log row as classified.',
  })
  classify(@Body() dto: ClassifyDomainDto) {
    return this.service.classifyUnknownDomain(dto.domain, dto.category, dto.wildcard ?? true);
  }
}
