import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckDnsPolicyDto {
  @ApiProperty({
    description: 'Source IP address of the DNS query',
    example: '192.168.1.100',
  })
  @IsString()
  sourceIp: string;

  @ApiProperty({
    description: 'Domain name being resolved',
    example: 'youtube.com',
  })
  @IsString()
  domain: string;
}

export class DnsPolicyResponseDto {
  @ApiProperty({
    description: 'Action to take',
    enum: ['ALLOW', 'BLOCK'],
    example: 'BLOCK',
  })
  action: 'ALLOW' | 'BLOCK';

  @ApiProperty({
    description: 'IP to return if blocked (0.0.0.0 for A, :: for AAAA)',
    example: '0.0.0.0',
  })
  blockIp: string;

  @ApiProperty({
    description: 'Reason for the action',
    enum: ['TIME_LIMIT_EXCEEDED', 'DOMAIN_BLOCKED', 'CATEGORY_BLOCKED', 'MANUAL_BLOCK', 'SESSION_VIOLATED', null],
    example: 'CATEGORY_BLOCKED',
    required: false,
  })
  reason: 'TIME_LIMIT_EXCEEDED' | 'DOMAIN_BLOCKED' | 'CATEGORY_BLOCKED' | 'MANUAL_BLOCK' | 'SESSION_VIOLATED' | null;

  @ApiProperty({
    description: 'Category that triggered the block (when reason=CATEGORY_BLOCKED)',
    required: false,
    example: 'GAMING',
  })
  category?: string | null;
}
