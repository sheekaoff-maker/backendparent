import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { DnsPolicyService } from './dns-policy.service';
import { CheckDnsPolicyDto, DnsPolicyResponseDto } from './dto/check-dns-policy.dto';

@ApiTags('DNS Policy')
@Controller('dns/policy')
export class DnsPolicyController {
  constructor(private readonly dnsPolicyService: DnsPolicyService) {}

  @Get('check')
  @ApiOperation({
    summary: 'Check DNS policy for a domain',
    description:
      'Called by the DNS server to determine if a domain should be ALLOWED or BLOCKED for a given source IP. Checks device status, active sessions, and blocked domain list.',
  })
  @ApiQuery({
    name: 'sourceIp',
    type: String,
    description: 'Source IP address of the DNS client',
    example: '192.168.1.100',
  })
  @ApiQuery({
    name: 'domain',
    type: String,
    description: 'Domain name being resolved',
    example: 'youtube.com',
  })
  @ApiResponse({
    status: 200,
    description: 'DNS policy decision',
    type: DnsPolicyResponseDto,
  })
  async check(@Query() dto: CheckDnsPolicyDto): Promise<DnsPolicyResponseDto> {
    return this.dnsPolicyService.checkPolicy(dto);
  }
}
