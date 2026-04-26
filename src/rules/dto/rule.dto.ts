import { IsString, IsOptional, IsEnum, IsInt, IsBoolean, IsArray, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RuleType } from '@prisma/client';

export class CreateRuleDto {
  @ApiProperty({ description: 'Child ID' })
  @IsUUID()
  childId: string;

  @ApiProperty({ enum: RuleType })
  @IsEnum(RuleType)
  type: RuleType;

  @ApiProperty({ description: 'Rule value (e.g. minutes for DAILY_LIMIT, HH:MM for BEDTIME)' })
  @IsString()
  value: string;

  @ApiPropertyOptional({ description: 'Start time HH:mm' })
  @IsOptional()
  @IsString()
  startTime?: string;

  @ApiPropertyOptional({ description: 'End time HH:mm' })
  @IsOptional()
  @IsString()
  endTime?: string;

  @ApiPropertyOptional({ description: 'Days of week e.g. "1,2,3,4,5"' })
  @IsOptional()
  @IsString()
  daysOfWeek?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blockedApps?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blockedCategories?: string[];

  @ApiPropertyOptional({ description: 'Extra minutes for REWARD_EXTRA_TIME' })
  @IsOptional()
  @IsInt()
  extraMinutes?: number;
}

export class UpdateRuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  value?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  daysOfWeek?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blockedApps?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blockedCategories?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  extraMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
