import { IsString, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RouterDetectionMethod } from '@prisma/client';

export class RouterDetectionReportDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vendor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firmwareVersion?: string;

  @ApiPropertyOptional({ enum: RouterDetectionMethod })
  @IsOptional()
  @IsEnum(RouterDetectionMethod)
  detectionMethod?: RouterDetectionMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  macOui?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hostname?: string;

  @ApiPropertyOptional({ description: '0-100 confidence score for this detection' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  confidence?: number;
}
