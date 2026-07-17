import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { DnsPolicyService } from './dns-policy.service';
import { CheckDnsPolicyDto, DnsPolicyResponseDto } from './dto/check-dns-policy.dto';

// The DNS resolver calls this endpoint for EVERY DNS query, so it must not be
// rate-limited by ANY throttler — otherwise real DNS traffic gets 429s and the
// resolver fails open (allows everything). It is an internal endpoint reached
// only from the co-located DNS service.
//
// IMPORTANT: `@SkipThrottle()` with no argument only skips the throttler named
// 'default'. Because ThrottlerModule.forRoot also registers the `auth_login`
// (5/60) and `auth_register` (10/60) throttlers — which apply to every route —
// we must skip ALL of them by name, or the DNS route stays capped at 5/min.
@SkipThrottle({ default: true, auth_login: true, auth_register: true })
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
