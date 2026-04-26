import { IsUUID, IsString, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUsageLogDto {
  @ApiProperty()
  @IsUUID()
  deviceId: string;

  @ApiProperty()
  @IsUUID()
  childId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  appName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ description: 'Duration in seconds' })
  @IsInt()
  @Min(1)
  durationSeconds: number;
}
