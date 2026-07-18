import { IsOptional, IsEnum, IsUUID, IsInt, IsBoolean, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BlockCategory } from '@prisma/client';

export class CreateBandwidthLimitDto {
  @ApiPropertyOptional({ description: 'Applies to every device belonging to this child' })
  @IsOptional()
  @IsUUID()
  childId?: string;

  @ApiPropertyOptional({ description: 'Applies to this single device only (overrides a child-level limit)' })
  @IsOptional()
  @IsUUID()
  deviceId?: string;

  @ApiPropertyOptional({
    enum: BlockCategory,
    description: "Narrows the limit to one traffic category; omit for the device/child's overall limit",
  })
  @IsOptional()
  @IsEnum(BlockCategory)
  category?: BlockCategory;

  @ApiPropertyOptional({ example: 1024, description: 'Download cap in Kbps' })
  @IsOptional()
  @IsInt()
  @Min(1)
  downloadKbps?: number;

  @ApiPropertyOptional({ example: 512, description: 'Upload cap in Kbps' })
  @IsOptional()
  @IsInt()
  @Min(1)
  uploadKbps?: number;
}

export class UpdateBandwidthLimitDto {
  @ApiPropertyOptional({ enum: BlockCategory })
  @IsOptional()
  @IsEnum(BlockCategory)
  category?: BlockCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  downloadKbps?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  uploadKbps?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
